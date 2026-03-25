"""
LakehousePlatform - Main FastAPI Application
Databricks-compatible REST API for unified data lakehouse operations
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import uvicorn

from api.routers import clusters, jobs, notebooks, sql, mlflow_router, streaming, catalog
from api.core.config import settings
from api.core.auth import get_current_user
from api.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    await init_db()
    yield


app = FastAPI(
    title="LakehousePlatform API",
    description="Open-source Databricks alternative - Unified Data Lakehouse Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(clusters.router, prefix="/api/2.0/clusters", tags=["Clusters"])
app.include_router(jobs.router, prefix="/api/2.0/jobs", tags=["Jobs"])
app.include_router(notebooks.router, prefix="/api/2.0/workspace", tags=["Workspace/Notebooks"])
app.include_router(sql.router, prefix="/api/2.0/sql", tags=["SQL Analytics"])
app.include_router(mlflow_router.router, prefix="/api/2.0/mlflow", tags=["MLflow"])
app.include_router(streaming.router, prefix="/api/2.0/streaming", tags=["Streaming"])
app.include_router(catalog.router, prefix="/api/2.0/unity-catalog", tags=["Data Catalog"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "platform": "LakehousePlatform"}


@app.get("/api/2.0/info", tags=["Info"])
async def platform_info(current_user=Depends(get_current_user)):
    return {
        "platform": "LakehousePlatform",
        "version": "1.0.0",
        "components": {
            "compute": "Apache Spark 3.5 on Kubernetes",
            "storage": "Delta Lake (delta-rs)",
            "sql": "Trino + Spark SQL",
            "ml": "MLflow + Ray",
            "streaming": "Apache Flink + Kafka",
            "catalog": "OpenMetadata"
        }
    }


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
