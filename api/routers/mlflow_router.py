"""
MLflow Router - Experiment tracking and model registry
Wraps MLflow REST API with Databricks-compatible extensions
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import mlflow
import mlflow.tracking
from mlflow.tracking import MlflowClient
import os

from api.core.auth import get_current_user

router = APIRouter()
mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000"))
client = MlflowClient()


class CreateExperimentRequest(BaseModel):
    name: str
    artifact_location: Optional[str] = None
    tags: Dict[str, str] = {}


class CreateRunRequest(BaseModel):
    experiment_id: str
    run_name: Optional[str] = None
    tags: Dict[str, str] = {}
    start_time: Optional[int] = None


class LogMetricRequest(BaseModel):
    run_id: str
    key: str
    value: float
    timestamp: Optional[int] = None
    step: int = 0


class LogParamRequest(BaseModel):
    run_id: str
    key: str
    value: str


class RegisterModelRequest(BaseModel):
    name: str
    source: str
    run_id: Optional[str] = None
    tags: Dict[str, str] = {}
    description: Optional[str] = None


@router.post("/experiments/create")
async def create_experiment(
    request: CreateExperimentRequest,
    current_user=Depends(get_current_user)
):
    """Create a new MLflow experiment"""
    experiment_id = mlflow.create_experiment(
        name=request.name,
        artifact_location=request.artifact_location,
        tags={**request.tags, "created_by": current_user.username}
    )
    return {"experiment_id": experiment_id}


@router.get("/experiments/get")
async def get_experiment(
    experiment_id: str,
    current_user=Depends(get_current_user)
):
    """Get experiment details"""
    exp = client.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp.to_dictionary()


@router.get("/experiments/list")
async def list_experiments(
    view_type: str = "ACTIVE_ONLY",
    max_results: int = 1000,
    current_user=Depends(get_current_user)
):
    """List all experiments"""
    experiments = client.search_experiments(max_results=max_results)
    return {"experiments": [exp.to_dictionary() for exp in experiments]}


@router.post("/runs/create")
async def create_run(
    request: CreateRunRequest,
    current_user=Depends(get_current_user)
):
    """Create a new MLflow run"""
    run = client.create_run(
        experiment_id=request.experiment_id,
        run_name=request.run_name,
        tags={**request.tags, "mlflow.user": current_user.username}
    )
    return run.to_dictionary()


@router.post("/runs/log-metric")
async def log_metric(
    request: LogMetricRequest,
    current_user=Depends(get_current_user)
):
    """Log a metric to a run"""
    client.log_metric(
        run_id=request.run_id,
        key=request.key,
        value=request.value,
        timestamp=request.timestamp,
        step=request.step
    )
    return {}


@router.post("/runs/log-param")
async def log_param(
    request: LogParamRequest,
    current_user=Depends(get_current_user)
):
    """Log a parameter to a run"""
    client.log_param(run_id=request.run_id, key=request.key, value=request.value)
    return {}


@router.post("/runs/update")
async def update_run(
    run_id: str,
    status: str,
    end_time: Optional[int] = None,
    current_user=Depends(get_current_user)
):
    """Update run status"""
    client.update_run(run_id=run_id, status=status, end_time=end_time)
    return {}


@router.get("/runs/search")
async def search_runs(
    experiment_ids: List[str],
    filter_string: str = "",
    order_by: Optional[List[str]] = None,
    max_results: int = 1000,
    current_user=Depends(get_current_user)
):
    """Search runs across experiments"""
    runs = client.search_runs(
        experiment_ids=experiment_ids,
        filter_string=filter_string,
        order_by=order_by,
        max_results=max_results
    )
    return {"runs": [r.to_dictionary() for r in runs]}


# Model Registry
@router.post("/registered-models/create")
async def create_registered_model(
    request: RegisterModelRequest,
    current_user=Depends(get_current_user)
):
    """Register a new model"""
    model = client.create_registered_model(
        name=request.name,
        tags=request.tags,
        description=request.description
    )
    return model.to_dictionary()


@router.post("/model-versions/create")
async def create_model_version(
    name: str,
    source: str,
    run_id: Optional[str] = None,
    description: Optional[str] = None,
    current_user=Depends(get_current_user)
):
    """Create a new model version"""
    version = client.create_model_version(
        name=name,
        source=source,
        run_id=run_id,
        description=description
    )
    return version.to_dictionary()


@router.post("/model-versions/transition-stage")
async def transition_model_version_stage(
    name: str,
    version: str,
    stage: str,
    archive_existing_versions: bool = False,
    current_user=Depends(get_current_user)
):
    """Transition model version to a new stage (Staging/Production/Archived)"""
    mv = client.transition_model_version_stage(
        name=name,
        version=version,
        stage=stage,
        archive_existing_versions=archive_existing_versions
    )
    return mv.to_dictionary()


@router.get("/registered-models/list")
async def list_registered_models(
    max_results: int = 1000,
    current_user=Depends(get_current_user)
):
    """List all registered models"""
    models = client.search_registered_models(max_results=max_results)
    return {"registered_models": [m.to_dictionary() for m in models]}
