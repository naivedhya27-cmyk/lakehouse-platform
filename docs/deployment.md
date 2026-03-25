# Deployment Guide

## Prerequisites

- Docker and Docker Compose (for local development)
- Kubernetes cluster v1.25+ (for production)
- Helm v3.12+ (for Helm deployment)
- Terraform v1.6+ (for cloud infrastructure)
- kubectl configured with cluster access

## Local Development

### Step 1: Clone and Configure

\`\`\`bash
git clone https://github.com/naivedhya27-cmyk/lakehouse-platform
cd lakehouse-platform
cp .env.example .env
# Edit .env with your settings
\`\`\`

### Step 2: Start Services

\`\`\`bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Or start core services only
docker-compose -f docker/docker-compose.yml up -d api frontend postgres redis minio

# Check service health
docker-compose -f docker/docker-compose.yml ps
\`\`\`

### Step 3: Initialize MinIO Buckets

The minio-init service automatically creates required buckets:
- lakehouse-data (Delta Lake tables)
- lakehouse-logs (Spark event logs)
- mlflow-artifacts (MLflow model artifacts)

### Step 4: Access Services

| Service | URL | Default Credentials |
|---|---|---|
| UI | http://localhost:3000 | - |
| API Docs | http://localhost:8000/docs | - |
| Jupyter | http://localhost:8888 | token: (see logs) |
| MLflow | http://localhost:5000 | - |
| Trino | http://localhost:8080 | user: admin |
| MinIO | http://localhost:9001 | lakehouse / lakehouse123 |
| Keycloak | http://localhost:8082 | admin / admin |
| Grafana | http://localhost:3001 | admin / admin |
| Spark UI | http://localhost:8081 | - |

## Kubernetes Deployment

### Option A: Raw Manifests

\`\`\`bash
# Create namespaces
kubectl apply -f k8s/manifests/00-namespace.yaml

# Deploy ConfigMap and secrets
kubectl apply -f k8s/manifests/04-configmap.yaml
kubectl create secret generic lakehouse-secrets \\
  --namespace lakehouse \\
  --from-literal=SECRET_KEY=your-secret-key \\
  --from-literal=DATABASE_URL=postgresql://... \\
  --from-literal=AWS_ACCESS_KEY_ID=... \\
  --from-literal=AWS_SECRET_ACCESS_KEY=...

# Deploy RBAC
kubectl apply -f k8s/manifests/05-rbac.yaml

# Deploy services
kubectl apply -f k8s/manifests/01-api-deployment.yaml
kubectl apply -f k8s/manifests/02-frontend-deployment.yaml
kubectl apply -f k8s/manifests/03-ingress.yaml
kubectl apply -f k8s/manifests/06-pdb.yaml
\`\`\`

### Option B: Helm Chart

\`\`\`bash
# Install with default values
helm install lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse \\
  --create-namespace

# Install with custom values
helm install lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse \\
  --create-namespace \\
  -f k8s/helm/lakehouse-platform/values.yaml \\
  --set api.image.tag=v1.0.0 \\
  --set postgresql.auth.password=secure-password

# Upgrade
helm upgrade lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse \\
  --set api.image.tag=v1.1.0

# Check status
helm status lakehouse -n lakehouse
kubectl get pods -n lakehouse
\`\`\`

## Cloud Deployment (Terraform)

### Google Cloud Platform (GCP)

\`\`\`bash
cd terraform/gcp

# Set variables
export TF_VAR_project_id=your-gcp-project
export TF_VAR_region=us-central1

# Initialize and deploy
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan

# Get GKE credentials
gcloud container clusters get-credentials lakehouse-prod \\
  --region us-central1 --project your-gcp-project

# Deploy platform on GKE
helm install lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse --create-namespace \\
  -f k8s/helm/values-production.yaml
\`\`\`

### Amazon Web Services (AWS)

\`\`\`bash
cd terraform/aws

# Set variables
export TF_VAR_aws_region=us-east-1
export TF_VAR_db_password=secure-password

# Initialize and deploy
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan

# Get EKS credentials
aws eks update-kubeconfig --name lakehouse-prod --region us-east-1

# Deploy platform on EKS
helm install lakehouse k8s/helm/lakehouse-platform \\
  --namespace lakehouse --create-namespace \\
  -f k8s/helm/values-production.yaml
\`\`\`

## Production Checklist

- [ ] Use managed databases (Cloud SQL / RDS) instead of in-cluster PostgreSQL
- [ ] Enable TLS with cert-manager
- [ ] Configure Keycloak with your identity provider
- [ ] Set strong SECRET_KEY and database passwords
- [ ] Enable backup for PostgreSQL and object storage
- [ ] Configure monitoring alerts in Grafana
- [ ] Set resource limits and requests for all pods
- [ ] Enable network policies
- [ ] Configure log aggregation (ELK or Loki)
- [ ] Set up DNS records for ingress hosts
- [ ] Enable object storage versioning
- [ ] Test disaster recovery procedures
