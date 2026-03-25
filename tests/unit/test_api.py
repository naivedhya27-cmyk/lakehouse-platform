"""
Unit tests for Cluster API
"""
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
import os

os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "postgresql://lakehouse:lakehouse@localhost:5432/lakehouse_test"

transport = ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_platform_info():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/2.0/info")
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "LakehousePlatform"
        assert "compute" in data["components"]


@pytest.mark.asyncio
async def test_create_cluster():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/2.0/clusters/create", json={
            "cluster_name": "test-cluster",
            "spark_version": "3.5.0",
            "num_workers": 2,
            "node_type_id": "Standard_4vCPU_16GB"
        })
        assert response.status_code == 200
        assert "cluster_id" in response.json()


@pytest.mark.asyncio
async def test_list_clusters():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/2.0/clusters/list")
        assert response.status_code == 200
        assert "clusters" in response.json()


@pytest.mark.asyncio
async def test_create_job():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/2.0/jobs/create", json={
            "name": "test-etl-job",
            "tasks": [{
                "task_key": "extract",
                "notebook_task": {
                    "notebook_path": "/Workspace/ETL/extract"
                }
            }]
        })
        assert response.status_code == 200
        assert "job_id" in response.json()


@pytest.mark.asyncio
async def test_sql_statement():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/2.0/sql/statements", json={
            "statement": "SELECT 1 as test_col",
            "warehouse_id": "wh-test"
        })
        assert response.status_code == 200
        assert response.json()["statement_id"]


@pytest.mark.asyncio
async def test_create_ml_experiment():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/2.0/mlflow/experiments/create", json={
            "name": "test-experiment"
        })
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_catalog_operations():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create catalog
        response = await client.post("/api/2.0/unity-catalog/catalogs", json={
            "name": "test_catalog"
        })
        assert response.status_code == 200
        
        # Create schema
        response = await client.post("/api/2.0/unity-catalog/schemas", json={
            "name": "test_schema",
            "catalog_name": "test_catalog"
        })
        assert response.status_code == 200
