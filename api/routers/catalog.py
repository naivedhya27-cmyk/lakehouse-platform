"""
Data Catalog Router - Unity Catalog compatible API
Manages catalogs, schemas, tables, and permissions
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict
from pydantic import BaseModel

from api.core.auth import get_current_user
from storage.delta_manager import DeltaManager

router = APIRouter()


class CatalogInfo(BaseModel):
    name: str
    comment: Optional[str] = None
    properties: Dict[str, str] = {}


class SchemaInfo(BaseModel):
    name: str
    catalog_name: str
    comment: Optional[str] = None
    properties: Dict[str, str] = {}


class ColumnInfo(BaseModel):
    name: str
    type_name: str
    nullable: bool = True
    comment: Optional[str] = None


class TableInfo(BaseModel):
    name: str
    catalog_name: str
    schema_name: str
    table_type: str = "MANAGED"  # MANAGED or EXTERNAL
    data_source_format: str = "DELTA"
    columns: List[ColumnInfo] = []
    comment: Optional[str] = None
    storage_location: Optional[str] = None
    properties: Dict[str, str] = {}


@router.post("/catalogs")
async def create_catalog(
    catalog: CatalogInfo,
    current_user=Depends(get_current_user)
):
    """Create a new catalog"""
    return catalog.dict()


@router.get("/catalogs")
async def list_catalogs(current_user=Depends(get_current_user)):
    """List all catalogs"""
    return {"catalogs": []}


@router.get("/catalogs/{catalog_name}")
async def get_catalog(
    catalog_name: str,
    current_user=Depends(get_current_user)
):
    """Get catalog details"""
    return {"name": catalog_name}


@router.post("/schemas")
async def create_schema(
    schema: SchemaInfo,
    current_user=Depends(get_current_user)
):
    """Create a new schema"""
    return schema.dict()


@router.get("/schemas")
async def list_schemas(
    catalog_name: str,
    current_user=Depends(get_current_user)
):
    """List schemas in a catalog"""
    return {"schemas": []}


@router.post("/tables")
async def create_table(
    table: TableInfo,
    current_user=Depends(get_current_user)
):
    """Create a new table"""
    return table.dict()


@router.get("/tables")
async def list_tables(
    catalog_name: str,
    schema_name: str,
    current_user=Depends(get_current_user)
):
    """List tables in a schema"""
    return {"tables": []}


@router.get("/tables/{full_name}")
async def get_table(
    full_name: str,
    current_user=Depends(get_current_user)
):
    """Get table details (full_name = catalog.schema.table)"""
    parts = full_name.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=400, detail="Expected format: catalog.schema.table")
    return {"name": parts[2], "catalog_name": parts[0], "schema_name": parts[1]}
