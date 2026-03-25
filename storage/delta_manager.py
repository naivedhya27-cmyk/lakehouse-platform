"""
DeltaManager - Delta Lake storage layer using delta-rs
Provides ACID transactions on object storage (S3/GCS/Azure/MinIO)
"""
import os
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
import deltalake as dl
from deltalake import DeltaTable, write_deltalake
from deltalake.writer import write_deltalake
import pyarrow as pa
import pyarrow.parquet as pq

logger = logging.getLogger(__name__)


class DeltaManager:
    """
    Manages Delta Lake tables using the delta-rs Rust library.
    Supports S3, GCS, Azure Blob Storage, and local/MinIO storage.
    """

    def __init__(self, storage_root: str, storage_options: Optional[dict] = None):
        self.storage_root = storage_root.rstrip("/")
        self.storage_options = storage_options or self._default_storage_options()

    def _default_storage_options(self) -> dict:
        """Get default storage options from environment"""
        options = {}

        # AWS S3 / MinIO
        if os.getenv("AWS_ACCESS_KEY_ID"):
            options.update({
                "AWS_ACCESS_KEY_ID": os.environ["AWS_ACCESS_KEY_ID"],
                "AWS_SECRET_ACCESS_KEY": os.environ["AWS_SECRET_ACCESS_KEY"],
                "AWS_REGION": os.getenv("AWS_REGION", "us-east-1"),
            })
            if os.getenv("AWS_ENDPOINT_URL"):  # MinIO
                options["AWS_ENDPOINT_URL"] = os.environ["AWS_ENDPOINT_URL"]
                options["AWS_ALLOW_HTTP"] = "true"

        # GCS
        elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            options["GOOGLE_APPLICATION_CREDENTIALS"] = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

        # Azure
        elif os.getenv("AZURE_STORAGE_ACCOUNT_KEY"):
            options.update({
                "AZURE_STORAGE_ACCOUNT_NAME": os.environ["AZURE_STORAGE_ACCOUNT_NAME"],
                "AZURE_STORAGE_ACCOUNT_KEY": os.environ["AZURE_STORAGE_ACCOUNT_KEY"],
            })

        return options

    def table_path(self, catalog: str, schema: str, table: str) -> str:
        """Get the storage path for a table"""
        return f"{self.storage_root}/{catalog}/{schema}/{table}"

    def create_table(
        self,
        catalog: str,
        schema: str,
        table: str,
        arrow_schema: pa.Schema,
        partition_by: Optional[List[str]] = None,
        mode: str = "error",
        properties: Optional[Dict[str, str]] = None
    ) -> DeltaTable:
        """Create a new Delta table"""
        path = self.table_path(catalog, schema, table)
        logger.info(f"Creating Delta table at {path}")

        empty_batch = pa.table(
            {field.name: pa.array([], type=field.type) for field in arrow_schema},
            schema=arrow_schema
        )

        write_deltalake(
            path,
            empty_batch,
            partition_by=partition_by or [],
            mode=mode,
            storage_options=self.storage_options,
            configuration=properties or {}
        )
        return DeltaTable(path, storage_options=self.storage_options)

    def get_table(self, catalog: str, schema: str, table: str) -> DeltaTable:
        """Open an existing Delta table"""
        path = self.table_path(catalog, schema, table)
        return DeltaTable(path, storage_options=self.storage_options)

    def write(
        self,
        catalog: str,
        schema: str,
        table: str,
        data: pa.Table,
        mode: str = "append",
        partition_by: Optional[List[str]] = None,
        schema_mode: str = "merge"
    ):
        """Write data to a Delta table"""
        path = self.table_path(catalog, schema, table)
        write_deltalake(
            path,
            data,
            mode=mode,
            partition_by=partition_by,
            schema_mode=schema_mode,
            storage_options=self.storage_options
        )

    def read(
        self,
        catalog: str,
        schema: str,
        table: str,
        version: Optional[int] = None,
        timestamp: Optional[str] = None,
        filters: Optional[list] = None,
        columns: Optional[List[str]] = None
    ) -> pa.Table:
        """Read data from a Delta table (supports time travel)"""
        path = self.table_path(catalog, schema, table)

        if version is not None:
            dt = DeltaTable(path, version=version, storage_options=self.storage_options)
        elif timestamp is not None:
            dt = DeltaTable(path, storage_options=self.storage_options)
            dt.load_as_version(timestamp)
        else:
            dt = DeltaTable(path, storage_options=self.storage_options)

        return dt.to_pyarrow_table(filters=filters, columns=columns)

    def optimize(self, catalog: str, schema: str, table: str, z_order_by: Optional[List[str]] = None):
        """Optimize table files (compaction + optional Z-ordering)"""
        dt = self.get_table(catalog, schema, table)
        if z_order_by:
            dt.optimize.z_order(z_order_by)
        else:
            dt.optimize.compact()

    def vacuum(self, catalog: str, schema: str, table: str, retention_hours: int = 168):
        """Vacuum old files from table (default 7-day retention)"""
        dt = self.get_table(catalog, schema, table)
        dt.vacuum(retention_hours=retention_hours, dry_run=False, enforce_retention_duration=True)

    def history(self, catalog: str, schema: str, table: str, limit: int = 20) -> List[dict]:
        """Get table version history"""
        dt = self.get_table(catalog, schema, table)
        return dt.history(limit=limit)

    def schema(self, catalog: str, schema: str, table: str) -> dict:
        """Get table schema"""
        dt = self.get_table(catalog, schema, table)
        return {
            "fields": [
                {"name": f.name, "type": str(f.type), "nullable": f.nullable, "metadata": f.metadata}
                for f in dt.schema().fields
            ]
        }

    def table_info(self, catalog: str, schema: str, table: str) -> dict:
        """Get detailed table information"""
        dt = self.get_table(catalog, schema, table)
        details = dt.detail()
        return {
            "path": self.table_path(catalog, schema, table),
            "format": "delta",
            "version": dt.version(),
            "num_files": details.num_files,
            "size_in_bytes": details.size_in_bytes,
            "partition_columns": details.partition_columns,
            "schema": self.schema(catalog, schema, table)
        }

    def merge(
        self,
        catalog: str,
        schema: str,
        table: str,
        source_data: pa.Table,
        merge_condition: str,
        when_matched_update: Optional[dict] = None,
        when_not_matched_insert: Optional[dict] = None
    ):
        """Merge (upsert) data into a Delta table"""
        dt = self.get_table(catalog, schema, table)
        merger = dt.merge(source_data, merge_condition)

        if when_matched_update:
            merger = merger.when_matched_update(when_matched_update)
        if when_not_matched_insert:
            merger = merger.when_not_matched_insert(when_not_matched_insert)

        merger.execute()
