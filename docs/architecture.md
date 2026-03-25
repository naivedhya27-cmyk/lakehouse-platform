# Architecture Guide

## System Architecture

LakehousePlatform is a modular, microservices-based data platform deployed on Kubernetes. Each component is independently scalable and communicates via REST APIs and message queues.

## Component Overview

### 1. API Gateway (FastAPI)

The central REST API serves as the control plane for all platform operations. It exposes a Databricks API 2.0 compatible interface, making it possible to use existing Databricks SDKs and tools.

**Key endpoints:**
- \`/api/2.0/clusters\` — Spark cluster lifecycle management
- \`/api/2.0/jobs\` — Job scheduling and orchestration
- \`/api/2.0/workspace\` — Notebook and file management
- \`/api/2.0/sql\` — SQL statement execution and warehouse management
- \`/api/2.0/mlflow\` — ML experiment tracking and model registry
- \`/api/2.0/streaming\` — Streaming pipeline management
- \`/api/2.0/unity-catalog\` — Data catalog (catalogs, schemas, tables)

The API uses async handlers with SQLAlchemy for database operations and integrates with Keycloak for authentication.

### 2. Compute Engine (Apache Spark on Kubernetes)

Spark clusters are managed via the **spark-on-k8s-operator** from Google Cloud Platform. Each cluster runs as a SparkApplication custom resource.

**Features:**
- Dynamic autoscaling based on workload
- Spot/preemptible instance support for cost optimization
- Multi-tenant isolation via Kubernetes namespaces
- GPU node pools for ML training workloads
- Automatic Spark UI proxy

The SparkClusterManager class handles the full cluster lifecycle: creating Kubernetes resources, monitoring pod status, scaling executors, and cleanup.

### 3. Storage Layer (Delta Lake via delta-rs)

All tabular data is stored in Delta Lake format on object storage (S3, GCS, Azure Blob, or MinIO for local development). The platform uses the **delta-rs** Rust library (via Python bindings) for performant Delta operations.

**Capabilities:**
- ACID transactions on cloud object storage
- Schema enforcement and evolution
- Time travel queries (read data at any past version)
- Z-ordering for query optimization
- MERGE (upsert) operations
- VACUUM for storage cleanup
- Compatible with Apache Spark Delta Lake reader/writer

### 4. SQL Analytics (Trino + Spark SQL)

The SQL engine supports two execution modes:
- **Trino** for federated, low-latency queries across heterogeneous sources
- **Spark SQL** (via Thrift Server) for heavy ETL and Delta Lake optimized queries

SQL Warehouses are logical clusters that can be scaled independently with auto-start and auto-stop capabilities.

### 5. Notebook Service (JupyterHub)

Interactive notebooks powered by JupyterHub with custom Spark kernels:
- PySpark kernel (connected to cluster)
- Scala Spark kernel
- SQL kernel
- R kernel with SparkR

Notebooks support parameterized execution, scheduling, and Git integration.

### 6. ML Pipeline Manager (MLflow + Ray)

- **MLflow** provides experiment tracking, model registry, and model serving
- **Ray** enables distributed training across GPU/CPU clusters
- Models can be promoted through stages: None → Staging → Production → Archived
- Built-in support for scikit-learn, XGBoost, PyTorch, and TensorFlow

### 7. Streaming Engine (Apache Flink + Kafka)

Real-time data pipelines using Apache Flink for stream processing and Kafka for message brokering. The DeltaLakeCDCPipeline provides pre-built patterns for:
- Change Data Capture (CDC) from Kafka to Delta Lake
- Windowed aggregations (tumbling, sliding, session windows)
- Stream-to-stream joins
- Exactly-once delivery guarantees

### 8. Data Catalog (Unity Catalog Compatible)

A three-level namespace (catalog.schema.table) compatible with Databricks Unity Catalog. Backed by OpenMetadata for rich metadata management including:
- Data lineage tracking
- Column-level descriptions and tags
- Data quality metrics
- Access control policies

### 9. Authentication & Authorization (Keycloak)

Keycloak provides enterprise-grade identity management:
- SSO via OIDC and SAML
- Role-Based Access Control (RBAC)
- API key authentication for service accounts
- Multi-factor authentication support
- Integration with LDAP/Active Directory

### 10. Monitoring (Prometheus + Grafana)

All services expose Prometheus metrics for comprehensive observability:
- API request latency and throughput
- Spark job execution metrics
- Query performance statistics
- Resource utilization (CPU, memory, disk)
- Custom Grafana dashboards for each component

## Data Flow

1. **Ingestion**: Data arrives via Kafka topics, file uploads, or API calls
2. **Processing**: Spark jobs or Flink pipelines transform raw data
3. **Storage**: Processed data lands in Delta Lake tables on object storage
4. **Catalog**: Table metadata is registered in the data catalog
5. **Query**: Users query data via SQL Editor, notebooks, or API
6. **ML**: Data scientists train models using MLflow + Ray on dedicated GPU clusters
7. **Serving**: Models are deployed via MLflow model serving

## Deployment Architecture

### Local Development
Docker Compose runs all services locally with MinIO as the S3-compatible storage backend.

### Kubernetes Production
Helm chart deploys all components on any Kubernetes cluster (GKE, EKS, AKS, bare-metal). Uses:
- Ingress with TLS for external access
- Persistent volumes for stateful services
- HPA for autoscaling API and frontend
- PDB for high availability during upgrades
- NetworkPolicy for security isolation

### Cloud Managed Services
Terraform modules provision cloud-native alternatives:
- **GCP**: GKE + Cloud SQL + GCS + IAM
- **AWS**: EKS + RDS + S3 + IAM (IRSA)
- **Azure**: AKS + Azure Database + ADLS + Managed Identity
