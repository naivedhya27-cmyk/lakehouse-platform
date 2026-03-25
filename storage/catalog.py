"""
Data Catalog Integration - OpenMetadata / Unity Catalog compatible
"""
import logging
from typing import Optional, Dict, List, Any
from storage.delta_manager import DeltaManager

logger = logging.getLogger(__name__)


class DataCatalog:
    """
    Manages data catalog metadata.
    Provides Unity Catalog compatible API for managing:
    - Catalogs (top-level namespace)
    - Schemas (databases)
    - Tables (Delta Lake tables)
    - Columns (table columns with types)
    """

    def __init__(self, delta_manager: DeltaManager):
        self.delta = delta_manager
        self._catalogs: Dict[str, dict] = {}
        self._schemas: Dict[str, dict] = {}
        self._tables: Dict[str, dict] = {}

    def create_catalog(self, name: str, comment: str = "", properties: dict = None) -> dict:
        """Create a new catalog namespace"""
        catalog = {
            "name": name,
            "comment": comment,
            "properties": properties or {},
            "owner": "admin"
        }
        self._catalogs[name] = catalog
        return catalog

    def list_catalogs(self) -> List[dict]:
        """List all catalogs"""
        return list(self._catalogs.values())

    def get_catalog(self, name: str) -> Optional[dict]:
        """Get catalog by name"""
        return self._catalogs.get(name)

    def create_schema(self, catalog_name: str, schema_name: str, comment: str = "") -> dict:
        """Create a schema within a catalog"""
        key = f"{catalog_name}.{schema_name}"
        schema = {
            "name": schema_name,
            "catalog_name": catalog_name,
            "full_name": key,
            "comment": comment,
            "owner": "admin"
        }
        self._schemas[key] = schema
        return schema

    def list_schemas(self, catalog_name: str) -> List[dict]:
        """List schemas in a catalog"""
        return [s for s in self._schemas.values() if s["catalog_name"] == catalog_name]

    def register_table(
        self,
        catalog_name: str,
        schema_name: str,
        table_name: str,
        table_type: str = "MANAGED",
        columns: List[dict] = None,
        storage_location: Optional[str] = None
    ) -> dict:
        """Register a table in the catalog"""
        full_name = f"{catalog_name}.{schema_name}.{table_name}"
        table = {
            "name": table_name,
            "catalog_name": catalog_name,
            "schema_name": schema_name,
            "full_name": full_name,
            "table_type": table_type,
            "data_source_format": "DELTA",
            "columns": columns or [],
            "storage_location": storage_location or self.delta.table_path(catalog_name, schema_name, table_name),
            "owner": "admin"
        }
        self._tables[full_name] = table
        return table

    def list_tables(self, catalog_name: str, schema_name: str) -> List[dict]:
        """List tables in a schema"""
        prefix = f"{catalog_name}.{schema_name}."
        return [t for key, t in self._tables.items() if key.startswith(prefix)]

    def get_table(self, full_name: str) -> Optional[dict]:
        """Get table by full name (catalog.schema.table)"""
        return self._tables.get(full_name)

    def get_table_details(self, full_name: str) -> Optional[dict]:
        """Get detailed table info including Delta Lake metadata"""
        table = self._tables.get(full_name)
        if not table:
            return None

        try:
            parts = full_name.split(".")
            delta_info = self.delta.table_info(parts[0], parts[1], parts[2])
            table["delta_info"] = delta_info
        except Exception as e:
            logger.warning(f"Could not fetch delta info for {full_name}: {e}")

        return table
