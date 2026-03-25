"""
SQL Analytics Router - Execute SQL queries via Trino and Spark SQL
Databricks-compatible SQL Warehouses API
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum
import uuid
import time

from api.core.auth import get_current_user
from sql.query_engine import QueryEngine

router = APIRouter()
query_engine = QueryEngine()


class StatementState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"
    CLOSED = "CLOSED"


class QueryDisposition(str, Enum):
    INLINE = "INLINE"
    EXTERNAL_LINKS = "EXTERNAL_LINKS"


class StatementRequest(BaseModel):
    statement: str
    warehouse_id: str
    catalog: Optional[str] = "main"
    schema_name: Optional[str] = "default"
    parameters: List[dict] = []
    row_limit: int = 10000
    byte_limit: int = 104857600  # 100MB
    disposition: QueryDisposition = QueryDisposition.INLINE
    format: str = "JSON_ARRAY"
    wait_timeout: str = "10s"


class ColumnMetadata(BaseModel):
    name: str
    type_name: str
    type_precision: int = 0
    type_scale: int = 0
    nullable: bool = True


class ResultSchema(BaseModel):
    column_count: int
    columns: List[ColumnMetadata]


class ResultData(BaseModel):
    byte_count: int = 0
    row_count: int = 0
    data_array: Optional[List[List[Any]]] = None
    external_links: Optional[List[dict]] = None


class StatementStatus(BaseModel):
    state: StatementState
    error: Optional[dict] = None


class StatementResponse(BaseModel):
    statement_id: str
    status: StatementStatus
    manifest: Optional[dict] = None
    result: Optional[ResultData] = None


@router.post("/statements", response_model=StatementResponse)
async def execute_statement(
    request: StatementRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Execute a SQL statement on a warehouse"""
    statement_id = str(uuid.uuid4())

    # Try to execute synchronously within wait_timeout
    try:
        result = await query_engine.execute(
            sql=request.statement,
            catalog=request.catalog,
            schema=request.schema_name,
            warehouse_id=request.warehouse_id,
            row_limit=request.row_limit
        )

        return StatementResponse(
            statement_id=statement_id,
            status=StatementStatus(state=StatementState.SUCCEEDED),
            manifest={
                "format": request.format,
                "schema": ResultSchema(
                    column_count=len(result.get("columns", [])),
                    columns=[ColumnMetadata(**c) for c in result.get("columns", [])]
                ).dict()
            },
            result=ResultData(
                row_count=len(result.get("data", [])),
                data_array=result.get("data", [])
            )
        )
    except Exception as e:
        return StatementResponse(
            statement_id=statement_id,
            status=StatementStatus(
                state=StatementState.FAILED,
                error={"error_code": "QUERY_FAILED", "message": str(e)}
            )
        )


@router.get("/statements/{statement_id}", response_model=StatementResponse)
async def get_statement(
    statement_id: str,
    current_user=Depends(get_current_user)
):
    """Get the status and result of a statement"""
    status = await query_engine.get_statement_status(statement_id)
    return StatementResponse(statement_id=statement_id, status=status)


@router.delete("/statements/{statement_id}")
async def cancel_statement(
    statement_id: str,
    current_user=Depends(get_current_user)
):
    """Cancel a running statement"""
    await query_engine.cancel_statement(statement_id)
    return {}


# SQL Warehouses Management
class WarehouseSize(str, Enum):
    XXSMALL = "2X-Small"
    XSMALL = "X-Small"
    SMALL = "Small"
    MEDIUM = "Medium"
    LARGE = "Large"
    XLARGE = "X-Large"


class CreateWarehouseRequest(BaseModel):
    name: str
    cluster_size: WarehouseSize = WarehouseSize.SMALL
    min_num_clusters: int = 1
    max_num_clusters: int = 3
    auto_stop_mins: int = 120
    enable_photon: bool = True
    warehouse_type: str = "PRO"
    spot_instance_policy: str = "COST_OPTIMIZED"


@router.post("/warehouses")
async def create_warehouse(
    request: CreateWarehouseRequest,
    current_user=Depends(get_current_user)
):
    """Create a SQL warehouse (Trino cluster)"""
    warehouse_id = f"wh-{uuid.uuid4().hex[:8]}"
    return {"id": warehouse_id}


@router.get("/warehouses")
async def list_warehouses(current_user=Depends(get_current_user)):
    """List all SQL warehouses"""
    return {"warehouses": []}


@router.get("/warehouses/{warehouse_id}")
async def get_warehouse(
    warehouse_id: str,
    current_user=Depends(get_current_user)
):
    """Get warehouse details"""
    return {
        "id": warehouse_id,
        "name": "Default Warehouse",
        "state": "RUNNING",
        "cluster_size": "Small",
        "num_clusters": 1,
        "creator_name": current_user.username
    }
