# LakehousePlatform

**An open-source, cloud-native Databricks alternative** - unified data lakehouse with distributed compute, Delta-compatible storage, interactive notebooks, SQL analytics, and ML pipeline management.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](docker/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-ready-blue.svg)](k8s/)
[![CI/CD](https://github.com/naivedhya27-cmyk/lakehouse-platform/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/naivedhya27-cmyk/lakehouse-platform/actions)

---

## What is LakehousePlatform?

LakehousePlatform is a fully open-source alternative to Databricks, providing a unified platform for data engineering, analytics, and machine learning.

### Feature Comparison

| Feature | LakehousePlatform | Databricks |
|---|---|---|
| Distributed Compute | Apache Spark on K8s | Managed Spark |
| Delta Lake Storage | delta-rs (Rust-based) | Proprietary Delta |
| Interactive Notebooks | JupyterHub + custom UI | Databricks Notebooks |
| SQL Analytics | Apache Spark SQL + Trino | SQL Warehouse |
| ML Pipelines | MLflow + Ray | MLflow + AutoML |
| Data Catalog | OpenMetadata (Unity Catalog compatible) | Unity Catalog |
| Streaming | Apache Flink + Kafka | Structured Streaming |
| REST API | FastAPI (Databricks API compatible) | REST API |
| Cost | FREE (infra costs only) | Premium pricing |

---

## Architecture

The platform is composed of modular services deployed on Kubernetes:

- **API Layer**: FastAPI backend with Databricks-compatible REST API
- **Compute Engine**: Apache Spark on Kubernetes (via spark-on-k8s-operator) with autoscaling and spot instance support
- **Storage Layer**: Delta Lake via delta-rs with S3/GCS/Azure/MinIO backends
- **SQL Analytics**: Trino for federated queries + Spark SQL for Delta Lake
- **Notebook Service**: JupyterHub with PySpark, Scala, SQL, and R kernels
- **ML Pipelines**: MLflow for experiment tracking + Ray for distributed training
- **Streaming**: Apache Flink + Kafka for real-time data pipelines
- **Data Catalog**: Unity Catalog compatible API powered by OpenMetadata
- **Auth**: Keycloak with OIDC/SAML SSO and RBAC
- **Monitoring**: Prometheus + Grafana

---

## Quick Start

### Local Development (Docker Compose)

\`\`\`bash
git clone https://github.com/naivedhya27-cmyk/lakehouse-platform
cd lakehouse-platform
cp .env.example .env
docker-compose -f docker/docker-compose.yml up -d
\`\`\`

Access points:
- UI: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Notebooks: http://localhost:8888
- MLflow: http://localhost:5000
- Trino: http://localhost:8080
- MinIO Console: http://localhost:9001
- Grafana: http://localhost:3001

### Kubernetes (Production)

\`\`\`bash
helm install lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse --create-namespace \\
  -f k8s/helm/lakehouse-platform/values.yaml
\`\`\`

### Cloud Deployment (Terraform)

\`\`\`bash
# GCP (GKE + Cloud SQL + GCS)
cd terraform/gcp && terraform init && terraform apply

# AWS (EKS + RDS + S3)
cd terraform/aws && terraform init && terraform apply
\`\`\`

---

## Core Components

### 1. Compute Engine (Spark on Kubernetes)
Dynamic Spark clusters with auto-scaling, spot/preemptible instances, multi-tenant isolation, and GPU support.

### 2. Delta Lake Storage
ACID transactions on object storage with schema enforcement, time travel, Z-ordering, and data skipping via delta-rs.

### 3. SQL Analytics
Federated queries via Trino across databases, data lakes, and streaming sources with query history and optimization.

### 4. Notebook Service
Python, Scala, SQL, and R kernels with real-time collaboration, Git integration, and scheduled execution.

### 5. ML Pipelines
MLflow experiment tracking, Ray distributed training, model registry, and serving.

### 6. Streaming Engine
Apache Flink stream processing with Kafka integration and Delta Lake streaming writes.

---

## API Compatibility

The REST API follows Databricks API 2.0 conventions:
- \`/api/2.0/clusters\` - Cluster management
- \`/api/2.0/jobs\` - Job scheduling
- \`/api/2.0/workspace\` - Notebook management
- \`/api/2.0/sql\` - SQL statements and warehouses
- \`/api/2.0/mlflow\` - MLflow experiment tracking
- \`/api/2.0/unity-catalog\` - Data catalog

---

## Security

- Keycloak-based SSO (OIDC/SAML)
- Role-Based Access Control (RBAC)
- Column-level security via Unity Catalog
- TLS encryption (cert-manager)
- Audit logging
- API key authentication

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache License 2.0 - see [LICENSE](LICENSE).
