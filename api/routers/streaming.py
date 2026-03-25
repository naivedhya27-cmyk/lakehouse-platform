"""
Streaming Router - Manage streaming pipelines (Flink + Kafka)
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict
from pydantic import BaseModel
from enum import Enum

from api.core.auth import get_current_user

router = APIRouter()


class StreamingPipelineState(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"
    FAILED = "FAILED"


class StreamSource(BaseModel):
    type: str  # kafka, s3, gcs, kinesis, delta
    config: Dict[str, str] = {}


class StreamSink(BaseModel):
    type: str  # delta, kafka, s3, gcs, bigquery, redshift
    config: Dict[str, str] = {}


class CreatePipelineRequest(BaseModel):
    name: str
    source: StreamSource
    sink: StreamSink
    transformations: List[dict] = []
    checkpoint_location: Optional[str] = None
    trigger_interval: str = "10 seconds"
    cluster_id: Optional[str] = None


@router.post("/pipelines")
async def create_pipeline(
    request: CreatePipelineRequest,
    current_user=Depends(get_current_user)
):
    """Create a new streaming pipeline"""
    return {"pipeline_id": "pipe-001", "state": StreamingPipelineState.CREATED}


@router.get("/pipelines")
async def list_pipelines(current_user=Depends(get_current_user)):
    """List all streaming pipelines"""
    return {"pipelines": []}


@router.get("/pipelines/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    current_user=Depends(get_current_user)
):
    """Get pipeline details"""
    return {"pipeline_id": pipeline_id, "state": "RUNNING"}


@router.post("/pipelines/{pipeline_id}/start")
async def start_pipeline(
    pipeline_id: str,
    current_user=Depends(get_current_user)
):
    """Start a streaming pipeline"""
    return {"pipeline_id": pipeline_id, "state": "RUNNING"}


@router.post("/pipelines/{pipeline_id}/stop")
async def stop_pipeline(
    pipeline_id: str,
    current_user=Depends(get_current_user)
):
    """Stop a streaming pipeline"""
    return {"pipeline_id": pipeline_id, "state": "STOPPED"}
