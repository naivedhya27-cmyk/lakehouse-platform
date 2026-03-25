"""
Jobs Router - Submit and manage Spark jobs
Databricks-compatible Jobs API 2.0
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from enum import Enum
import uuid
import time

from api.core.auth import get_current_user
from compute.spark_manager import SparkClusterManager

router = APIRouter()
cluster_manager = SparkClusterManager()


class RunResultState(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEDOUT = "TIMEDOUT"
    CANCELED = "CANCELED"


class RunLifeCycleState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"
    SKIPPED = "SKIPPED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class NotebookTask(BaseModel):
    notebook_path: str
    base_parameters: Dict[str, str] = {}
    source: str = "WORKSPACE"


class SparkPythonTask(BaseModel):
    python_file: str
    parameters: List[str] = []


class SparkJarTask(BaseModel):
    jar_uri: str
    main_class_name: str
    parameters: List[str] = []


class SparkSubmitTask(BaseModel):
    parameters: List[str] = []


class PythonWheelTask(BaseModel):
    package_name: str
    entry_point: str
    parameters: List[str] = []


class JobCluster(BaseModel):
    job_cluster_key: str
    new_cluster: Optional[dict] = None


class TaskDependency(BaseModel):
    task_key: str


class JobTask(BaseModel):
    task_key: str
    description: Optional[str] = ""
    depends_on: List[TaskDependency] = []
    existing_cluster_id: Optional[str] = None
    job_cluster_key: Optional[str] = None
    notebook_task: Optional[NotebookTask] = None
    spark_python_task: Optional[SparkPythonTask] = None
    spark_jar_task: Optional[SparkJarTask] = None
    spark_submit_task: Optional[SparkSubmitTask] = None
    python_wheel_task: Optional[PythonWheelTask] = None
    timeout_seconds: int = 0
    max_retries: int = 0
    libraries: List[dict] = []


class JobSchedule(BaseModel):
    quartz_cron_expression: str
    timezone_id: str = "UTC"
    pause_status: str = "UNPAUSED"


class CreateJobRequest(BaseModel):
    name: str
    tasks: List[JobTask] = []
    job_clusters: List[JobCluster] = []
    schedule: Optional[JobSchedule] = None
    max_concurrent_runs: int = 1
    timeout_seconds: int = 0
    tags: Dict[str, str] = {}
    format: str = "MULTI_TASK"


@router.post("/create")
async def create_job(
    job: CreateJobRequest,
    current_user=Depends(get_current_user)
):
    """Create a new job"""
    job_id = str(uuid.uuid4())[:8]
    # Store job definition
    return {"job_id": job_id}


@router.post("/run-now")
async def run_job_now(
    job_id: int,
    notebook_params: Optional[Dict[str, str]] = None,
    python_params: Optional[List[str]] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user=Depends(get_current_user)
):
    """Trigger a job run immediately"""
    run_id = int(time.time())
    background_tasks.add_task(cluster_manager.submit_job_run, job_id, run_id)
    return {"run_id": run_id, "number_in_job": 1}


@router.post("/runs/submit")
async def submit_run(
    tasks: List[JobTask],
    run_name: Optional[str] = None,
    existing_cluster_id: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user=Depends(get_current_user)
):
    """Submit a one-time run"""
    run_id = int(time.time())
    return {"run_id": run_id}


@router.get("/runs/get")
async def get_run(
    run_id: int,
    current_user=Depends(get_current_user)
):
    """Get information about a run"""
    return {
        "run_id": run_id,
        "state": {
            "life_cycle_state": RunLifeCycleState.RUNNING,
            "result_state": None,
            "state_message": "Run is in progress"
        },
        "start_time": int(time.time() * 1000),
        "setup_duration": 1000,
        "execution_duration": 5000,
    }


@router.post("/runs/cancel")
async def cancel_run(
    run_id: int,
    current_user=Depends(get_current_user)
):
    """Cancel a run"""
    await cluster_manager.cancel_run(run_id)
    return {}


@router.get("/runs/list")
async def list_runs(
    job_id: Optional[int] = None,
    active_only: bool = False,
    completed_only: bool = False,
    limit: int = 25,
    current_user=Depends(get_current_user)
):
    """List job runs"""
    return {"runs": [], "has_more": False}


@router.get("/list")
async def list_jobs(
    limit: int = 25,
    offset: int = 0,
    current_user=Depends(get_current_user)
):
    """List all jobs"""
    return {"jobs": [], "has_more": False}


@router.post("/delete")
async def delete_job(
    job_id: int,
    current_user=Depends(get_current_user)
):
    """Delete a job"""
    return {}
