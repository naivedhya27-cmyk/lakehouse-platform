# API Reference

## Authentication

All API endpoints require authentication via Bearer token (JWT from Keycloak) or API key.

\`\`\`bash
# Using Bearer token
curl -H "Authorization: Bearer <JWT_TOKEN>" http://api.lakehouse.example.com/api/2.0/clusters/list

# Using API key
curl -H "X-API-Key: <API_KEY>" http://api.lakehouse.example.com/api/2.0/clusters/list
\`\`\`

## Clusters API

### Create Cluster
\`POST /api/2.0/clusters/create\`

\`\`\`json
{
  "cluster_name": "my-spark-cluster",
  "spark_version": "3.5.0",
  "node_type_id": "Standard_4vCPU_16GB",
  "num_workers": 4,
  "spark_conf": {
    "spark.sql.shuffle.partitions": "200"
  },
  "custom_tags": {
    "team": "data-engineering"
  }
}
\`\`\`

Response: \`{"cluster_id": "cluster-abc12345"}\`

### Start Cluster
\`POST /api/2.0/clusters/start\`

### Get Cluster
\`GET /api/2.0/clusters/get?cluster_id=cluster-abc12345\`

### List Clusters
\`GET /api/2.0/clusters/list\`

### Resize Cluster
\`POST /api/2.0/clusters/resize\`

### Delete Cluster
\`POST /api/2.0/clusters/delete\`

## Jobs API

### Create Job
\`POST /api/2.0/jobs/create\`

\`\`\`json
{
  "name": "Daily ETL Pipeline",
  "tasks": [
    {
      "task_key": "extract",
      "notebook_task": {
        "notebook_path": "/ETL/extract"
      },
      "existing_cluster_id": "cluster-abc12345"
    },
    {
      "task_key": "transform",
      "depends_on": [{"task_key": "extract"}],
      "spark_python_task": {
        "python_file": "s3://lakehouse-data/jobs/transform.py"
      }
    }
  ],
  "schedule": {
    "quartz_cron_expression": "0 0 6 * * ?",
    "timezone_id": "UTC"
  }
}
\`\`\`

### Run Now
\`POST /api/2.0/jobs/run-now\`

### List Runs
\`GET /api/2.0/jobs/runs/list?job_id=123\`

## SQL API

### Execute Statement
\`POST /api/2.0/sql/statements\`

\`\`\`json
{
  "statement": "SELECT * FROM main.analytics.daily_metrics LIMIT 100",
  "warehouse_id": "wh-default",
  "catalog": "main",
  "schema_name": "analytics"
}
\`\`\`

Response includes column metadata and row data.

### Create SQL Warehouse
\`POST /api/2.0/sql/warehouses\`

## Unity Catalog API

### Create Catalog
\`POST /api/2.0/unity-catalog/catalogs\`

### Create Schema
\`POST /api/2.0/unity-catalog/schemas\`

### Create Table
\`POST /api/2.0/unity-catalog/tables\`

### List Tables
\`GET /api/2.0/unity-catalog/tables?catalog_name=main&schema_name=default\`

## MLflow API

### Create Experiment
\`POST /api/2.0/mlflow/experiments/create\`

### Log Metric
\`POST /api/2.0/mlflow/runs/log-metric\`

### Register Model
\`POST /api/2.0/mlflow/registered-models/create\`

### Transition Model Stage
\`POST /api/2.0/mlflow/model-versions/transition-stage\`

## Streaming API

### Create Pipeline
\`POST /api/2.0/streaming/pipelines\`

\`\`\`json
{
  "name": "user-events-to-delta",
  "source": {
    "type": "kafka",
    "config": {"topic": "user_events", "bootstrap.servers": "kafka:9092"}
  },
  "sink": {
    "type": "delta",
    "config": {"table": "main.default.user_events"}
  },
  "trigger_interval": "10 seconds"
}
\`\`\`

### Start Pipeline
\`POST /api/2.0/streaming/pipelines/{pipeline_id}/start\`

## Health Check
\`GET /health\`

Response: \`{"status": "healthy", "version": "1.0.0"}\`

## Interactive API Documentation
Full Swagger/OpenAPI documentation available at: \`/docs\`
ReDoc available at: \`/redoc\`
