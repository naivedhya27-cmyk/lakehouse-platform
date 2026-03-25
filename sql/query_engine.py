"""
QueryEngine - SQL execution via Trino (federated) and Spark SQL
"""
import logging
import os
from typing import Optional, Dict, Any, List
import trino
from trino.dbapi import connect as trino_connect

logger = logging.getLogger(__name__)


class QueryEngine:
    """
    Executes SQL queries using Trino for federated queries
    and Spark SQL via Spark Thrift Server for Delta Lake queries.
    """

    def __init__(self):
        self.trino_host = os.getenv("TRINO_HOST", "trino")
        self.trino_port = int(os.getenv("TRINO_PORT", "8080"))
        self.spark_thrift_host = os.getenv("SPARK_THRIFT_HOST", "spark-thrift")
        self.spark_thrift_port = int(os.getenv("SPARK_THRIFT_PORT", "10000"))
        self._statements: Dict[str, dict] = {}

    def _get_trino_connection(self, catalog: str, schema: str, user: str = "admin"):
        """Get a Trino connection"""
        return trino_connect(
            host=self.trino_host,
            port=self.trino_port,
            user=user,
            catalog=catalog,
            schema=schema,
            http_scheme="http",
        )

    async def execute(
        self,
        sql: str,
        catalog: str = "main",
        schema: str = "default",
        warehouse_id: Optional[str] = None,
        row_limit: int = 10000,
        user: str = "admin"
    ) -> Dict[str, Any]:
        """Execute a SQL query and return results"""
        try:
            conn = self._get_trino_connection(catalog, schema, user)
            cursor = conn.cursor()
            cursor.execute(sql)

            # Get column metadata
            columns = []
            if cursor.description:
                for col in cursor.description:
                    columns.append({
                        "name": col[0],
                        "type_name": self._trino_type_to_name(col[1]),
                        "nullable": True
                    })

            # Fetch results
            rows = cursor.fetchmany(row_limit)
            data = [list(row) for row in rows]

            return {"columns": columns, "data": data, "row_count": len(data)}

        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def _trino_type_to_name(self, type_code: Any) -> str:
        """Map Trino type codes to readable names"""
        type_map = {
            "varchar": "STRING",
            "bigint": "LONG",
            "integer": "INT",
            "double": "DOUBLE",
            "boolean": "BOOLEAN",
            "timestamp": "TIMESTAMP",
            "date": "DATE",
            "decimal": "DECIMAL",
            "array": "ARRAY",
            "map": "MAP",
            "row": "STRUCT"
        }
        return type_map.get(str(type_code).lower(), "STRING")

    async def get_statement_status(self, statement_id: str) -> dict:
        """Get the status of a statement"""
        stmt = self._statements.get(statement_id)
        if not stmt:
            return {"state": "CLOSED"}
        return {"state": stmt.get("state", "PENDING")}

    async def cancel_statement(self, statement_id: str):
        """Cancel a running statement"""
        if statement_id in self._statements:
            self._statements[statement_id]["state"] = "CANCELED"

    async def get_query_history(
        self,
        warehouse_id: Optional[str] = None,
        limit: int = 25
    ) -> List[dict]:
        """Get query history"""
        return []
