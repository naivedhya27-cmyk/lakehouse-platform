"""
Flink Streaming Job - Delta Lake CDC pipeline
Reads from Kafka and writes to Delta Lake tables
"""
import os
import json
import logging
from typing import Optional, Dict, Any

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment, EnvironmentSettings
from pyflink.table.descriptors import Schema
from pyflink.common import Configuration

logger = logging.getLogger(__name__)


class DeltaLakeCDCPipeline:
    """
    Apache Flink streaming pipeline that reads CDC events from Kafka
    and applies them to Delta Lake tables as upserts.
    """

    def __init__(
        self,
        kafka_bootstrap: str = "kafka:29092",
        delta_storage_root: str = "s3://lakehouse-data",
        checkpoint_dir: str = "s3://lakehouse-data/_checkpoints",
    ):
        self.kafka_bootstrap = kafka_bootstrap
        self.delta_storage_root = delta_storage_root
        self.checkpoint_dir = checkpoint_dir

        # Set up Flink environment
        config = Configuration()
        config.set_string("state.backend", "rocksdb")
        config.set_string("state.checkpoints.dir", checkpoint_dir)
        config.set_string("execution.checkpointing.interval", "60s")
        config.set_string("execution.checkpointing.mode", "EXACTLY_ONCE")
        config.set_string("restart-strategy", "fixed-delay")
        config.set_string("restart-strategy.fixed-delay.attempts", "3")
        config.set_string("restart-strategy.fixed-delay.delay", "10s")

        self.env = StreamExecutionEnvironment.get_execution_environment(config)
        self.t_env = StreamTableEnvironment.create(self.env)

    def create_kafka_source(self, topic: str, group_id: str, schema_sql: str):
        """Register a Kafka source table with the given schema"""
        ddl = f"""
        CREATE TABLE kafka_source (
            {schema_sql},
            event_time TIMESTAMP(3),
            WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
        ) WITH (
            'connector' = 'kafka',
            'topic' = '{topic}',
            'properties.bootstrap.servers' = '{self.kafka_bootstrap}',
            'properties.group.id' = '{group_id}',
            'scan.startup.mode' = 'latest-offset',
            'format' = 'json',
            'json.timestamp-format.standard' = 'ISO-8601',
            'json.fail-on-missing-field' = 'false'
        )
        """
        self.t_env.execute_sql(ddl)

    def create_delta_sink(self, table_name: str, path: str, schema_sql: str, partition_by: str = ""):
        """Register a Delta Lake sink table"""
        partition_clause = f"PARTITIONED BY ({partition_by})" if partition_by else ""
        ddl = f"""
        CREATE TABLE delta_sink (
            {schema_sql}
        ) {partition_clause}
        WITH (
            'connector' = 'delta',
            'table-path' = '{path}',
            'storage.path' = '{self.delta_storage_root}'
        )
        """
        self.t_env.execute_sql(ddl)

    def run_cdc_pipeline(
        self,
        source_topic: str,
        target_table: str,
        schema_sql: str,
        transform_sql: Optional[str] = None,
        group_id: str = "lakehouse-cdc"
    ):
        """
        Run a CDC pipeline from Kafka to Delta Lake.
        
        1. Reads JSON events from Kafka topic
        2. Applies optional SQL transformation
        3. Writes/upserts to Delta Lake table
        """
        target_path = f"{self.delta_storage_root}/{target_table}"

        self.create_kafka_source(source_topic, group_id, schema_sql)
        self.create_delta_sink(target_table, target_path, schema_sql)

        if transform_sql:
            result = self.t_env.sql_query(transform_sql)
            result.execute_insert("delta_sink")
        else:
            self.t_env.execute_sql("INSERT INTO delta_sink SELECT * FROM kafka_source")

        self.env.execute(f"CDC-{source_topic}-to-{target_table}")

    def run_aggregation_pipeline(
        self,
        source_topic: str,
        target_table: str,
        schema_sql: str,
        agg_sql: str,
        window_size: str = "1 MINUTE",
        group_id: str = "lakehouse-agg"
    ):
        """
        Run a windowed aggregation pipeline from Kafka to Delta Lake.
        Uses tumbling windows for real-time aggregated metrics.
        """
        target_path = f"{self.delta_storage_root}/{target_table}"

        self.create_kafka_source(source_topic, group_id, schema_sql)

        windowed_sql = f"""
        SELECT 
            TUMBLE_START(event_time, INTERVAL '{window_size}') AS window_start,
            TUMBLE_END(event_time, INTERVAL '{window_size}') AS window_end,
            {agg_sql}
        FROM kafka_source
        GROUP BY TUMBLE(event_time, INTERVAL '{window_size}')
        """

        result = self.t_env.sql_query(windowed_sql)
        result.execute_insert("delta_sink")
        self.env.execute(f"Agg-{source_topic}-to-{target_table}")


def main():
    """Example: Run a user events CDC pipeline"""
    pipeline = DeltaLakeCDCPipeline(
        kafka_bootstrap=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092"),
        delta_storage_root=os.getenv("STORAGE_ROOT", "s3://lakehouse-data"),
    )

    pipeline.run_cdc_pipeline(
        source_topic="user_events",
        target_table="analytics/events/user_events",
        schema_sql="""
            user_id STRING,
            event_type STRING,
            event_data STRING,
            session_id STRING,
            ip_address STRING,
            user_agent STRING
        """,
        transform_sql="""
            SELECT 
                user_id,
                event_type,
                event_data,
                session_id,
                ip_address,
                SUBSTRING(user_agent, 1, 200) AS user_agent,
                event_time
            FROM kafka_source
            WHERE event_type IS NOT NULL
        """
    )


if __name__ == "__main__":
    main()
