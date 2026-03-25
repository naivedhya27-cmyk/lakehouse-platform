"""
Clusters Router - Manage Apache Spark clusters on Kubernetes
Databricks-compatible Clusters API 2.0
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

from api.core.auth import get_current_user
from compute.spark_manager import SparkClusterManager

router = APIRouter()
cluster_manager = SparkClusterManager()


class ClusterState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    RESTARTING = "RESTARTING"
    RESIZING = "RESIZING"
    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"
    ERROR = "ERROR"


class AutoScale(BaseModel):
    min_workers: int = 1
    max_workers: int = 10


class ClusterSpec(BaseModel):
    cluster_name: str
    spark_version: str = "3.5.0"
    node_type_id: str = "Standard_4vCPU_16GB"
    num_workers: Optional[int] = 2
    autoscale: Optional[AutoScale] = None
    spark_conf: dict = {}
    spark_env_vars: dict = {}
    custom_tags: dict = {}
    enable_elastic_disk: bool = True
    driver_node_type_id: Optional[str] = None
    cluster_log_conf: Optional[dict] = None
    init_scripts: List[dict] = []


class ClusterInfo(BaseModel):
    cluster_id: str
    cluster_name: str
    state: ClusterState
    state_message: str = ""
    num_workers: int = 0
    driver: Optional[dict] = None
    executors: List[dict] = []
    spark_version: str
    node_type_id: str
    spark_ui_url: Optional[str] = None
    start_time: Optional[int] = None
    terminated_time: Optional[int] = None
    creator_user_name: Optional[str] = None


@router.post("/create")
async def create_cluster(
    spec: ClusterSpec,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Create a new Spark cluster on Kubernetes"""
    cluster_id = await cluster_manager.create_cluster(spec.dict(), current_user.username)
    background_tasks.add_task(cluster_manager.start_cluster, cluster_id)
    return {"cluster_id": cluster_id}


@router.post("/start")
async def start_cluster(
    cluster_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Start a terminated cluster"""
    await cluster_manager.validate_cluster_access(cluster_id, current_user)
    background_tasks.add_task(cluster_manager.start_cluster, cluster_id)
    return {}


@router.post("/restart")
async def restart_cluster(
    cluster_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user)
):
    """Restart a running cluster"""
    await cluster_manager.validate_cluster_access(cluster_id, current_user)
    background_tasks.add_task(cluster_manager.restart_cluster, cluster_id)
    return {}


@router.post("/delete")
async def delete_cluster(
    cluster_id: str,
    current_user=Depends(get_current_user)
):
    """Permanently delete a cluster"""
    await cluster_manager.validate_cluster_access(cluster_id, current_user)
    await cluster_manager.delete_cluster(cluster_id)
    return {}


@router.get("/get", response_model=ClusterInfo)
async def get_cluster(
    cluster_id: str,
    current_user=Depends(get_current_user)
):
    """Get cluster information"""
    cluster = await cluster_manager.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")
    return cluster


@router.get("/list")
async def list_clusters(current_user=Depends(get_current_user)):
    """List all clusters accessible to the user"""
    clusters = await cluster_manager.list_clusters(current_user.username)
    return {"clusters": clusters}


@router.post("/resize")
async def resize_cluster(
    cluster_id: str,
    num_workers: Optional[int] = None,
    autoscale: Optional[AutoScale] = None,
    current_user=Depends(get_current_user)
):
    """Resize a running cluster"""
    await cluster_manager.validate_cluster_access(cluster_id, current_user)
    await cluster_manager.resize_cluster(cluster_id, num_workers, autoscale)
    return {}


@router.get("/{cluster_id}/events")
async def get_cluster_events(
    cluster_id: str,
    current_user=Depends(get_current_user)
):
    """Get cluster event log"""
    events = await cluster_manager.get_cluster_events(cluster_id)
    return {"events": events, "total_count": len(events)}
