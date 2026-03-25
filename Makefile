.PHONY: help dev build test lint deploy clean

# LakehousePlatform Makefile

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================
# Development
# ============================================================

dev: ## Start local development environment
	docker-compose -f docker/docker-compose.yml up -d
	@echo "\n✅ LakehousePlatform is running!"
	@echo "   UI:        http://localhost:3000"
	@echo "   API:       http://localhost:8000/docs"
	@echo "   Notebooks: http://localhost:8888"
	@echo "   MLflow:    http://localhost:5000"
	@echo "   MinIO:     http://localhost:9001"

dev-core: ## Start core services only (API, DB, Redis, MinIO)
	docker-compose -f docker/docker-compose.yml up -d api postgres redis minio minio-init frontend
	@echo "\n✅ Core services running"

dev-stop: ## Stop all development services
	docker-compose -f docker/docker-compose.yml down

dev-logs: ## View logs for all services
	docker-compose -f docker/docker-compose.yml logs -f

dev-reset: ## Reset development environment (removes volumes)
	docker-compose -f docker/docker-compose.yml down -v
	@echo "✅ All volumes removed"

# ============================================================
# Backend
# ============================================================

api-run: ## Run API locally (requires virtualenv)
	uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

api-shell: ## Open Python shell with app context
	python -c "from api.main import app; print('App ready')"

# ============================================================
# Frontend
# ============================================================

frontend-dev: ## Run frontend dev server
	cd frontend && npm start

frontend-build: ## Build frontend for production
	cd frontend && npm run build

frontend-install: ## Install frontend dependencies
	cd frontend && npm install

# ============================================================
# Testing
# ============================================================

test: ## Run all tests
	pytest tests/ -v --tb=short

test-unit: ## Run unit tests only
	pytest tests/unit/ -v

test-integration: ## Run integration tests
	pytest tests/integration/ -v --timeout=60

test-coverage: ## Run tests with coverage report
	pytest tests/ -v --cov=api --cov=compute --cov=storage --cov=sql \
		--cov-report=term-missing --cov-report=html

# ============================================================
# Linting & Formatting
# ============================================================

lint: ## Run all linters
	ruff check .
	black --check .
	isort --check-only .

format: ## Auto-format code
	black .
	isort .
	ruff check --fix .

type-check: ## Run type checking
	mypy api/ compute/ storage/ sql/ --ignore-missing-imports

# ============================================================
# Docker
# ============================================================

build: ## Build all Docker images
	docker build -t lakehouse-api -f docker/Dockerfiles/api.Dockerfile .
	docker build -t lakehouse-frontend -f docker/Dockerfiles/frontend.Dockerfile frontend/

build-api: ## Build API Docker image
	docker build -t lakehouse-api -f docker/Dockerfiles/api.Dockerfile .

build-frontend: ## Build frontend Docker image
	docker build -t lakehouse-frontend -f docker/Dockerfiles/frontend.Dockerfile frontend/

push: ## Push Docker images to registry
	docker tag lakehouse-api ghcr.io/naivedhya27-cmyk/lakehouse-api:latest
	docker tag lakehouse-frontend ghcr.io/naivedhya27-cmyk/lakehouse-frontend:latest
	docker push ghcr.io/naivedhya27-cmyk/lakehouse-api:latest
	docker push ghcr.io/naivedhya27-cmyk/lakehouse-frontend:latest

# ============================================================
# Kubernetes
# ============================================================

k8s-deploy: ## Deploy to Kubernetes using Helm
	helm upgrade --install lakehouse k8s/helm/lakehouse-platform \
		--namespace lakehouse --create-namespace \
		-f k8s/helm/lakehouse-platform/values.yaml

k8s-status: ## Check deployment status
	kubectl get pods -n lakehouse
	kubectl get svc -n lakehouse

k8s-logs: ## View API logs in Kubernetes
	kubectl logs -f -l app=lakehouse-api -n lakehouse

k8s-raw-deploy: ## Deploy using raw manifests
	kubectl apply -f k8s/manifests/

# ============================================================
# Terraform
# ============================================================

tf-gcp-plan: ## Plan GCP infrastructure
	cd terraform/gcp && terraform plan

tf-gcp-apply: ## Apply GCP infrastructure
	cd terraform/gcp && terraform apply

tf-aws-plan: ## Plan AWS infrastructure
	cd terraform/aws && terraform plan

tf-aws-apply: ## Apply AWS infrastructure
	cd terraform/aws && terraform apply

# ============================================================
# Cleanup
# ============================================================

clean: ## Clean build artifacts
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .mypy_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf htmlcov/ .coverage coverage.xml
	rm -rf frontend/build frontend/node_modules
