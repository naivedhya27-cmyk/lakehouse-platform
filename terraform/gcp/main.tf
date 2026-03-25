# LakehousePlatform - GCP Terraform Configuration
# Provisions: GKE cluster, Cloud SQL, GCS buckets, VPC, IAM

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  backend "gcs" {
    bucket = "lakehouse-terraform-state"
    prefix = "gcp/prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ============================================================
# Variables
# ============================================================
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
  default     = "lakehouse-prod"
}

variable "node_count" {
  description = "Number of nodes per zone"
  type        = number
  default     = 3
}

variable "machine_type" {
  description = "GCE machine type for nodes"
  type        = string
  default     = "n2-standard-8"
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "prod"
}

# ============================================================
# VPC Network
# ============================================================
resource "google_compute_network" "lakehouse_vpc" {
  name                    = "lakehouse-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "lakehouse_subnet" {
  name          = "lakehouse-subnet"
  ip_cidr_range = "10.0.0.0/16"
  network       = google_compute_network.lakehouse_vpc.id
  region        = var.region

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/20"
  }
}

# ============================================================
# GKE Cluster
# ============================================================
resource "google_container_cluster" "lakehouse" {
  name     = var.cluster_name
  location = var.region
  project  = var.project_id

  # Use separate node pools
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.lakehouse_vpc.name
  subnetwork = google_compute_subnetwork.lakehouse_subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  addons_config {
    horizontal_pod_autoscaling {
      disabled = false
    }
    http_load_balancing {
      disabled = false
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
    gcs_fuse_csi_driver_config {
      enabled = true
    }
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus {
      enabled = true
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  release_channel {
    channel = "REGULAR"
  }

  lifecycle {
    ignore_changes = [initial_node_count]
  }
}

# Core node pool (API, databases, etc.)
resource "google_container_node_pool" "core" {
  name       = "core-pool"
  cluster    = google_container_cluster.lakehouse.id
  node_count = 2

  autoscaling {
    min_node_count = 2
    max_node_count = 6
  }

  node_config {
    machine_type = "n2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env  = var.environment
      pool = "core"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}

# Spark compute node pool (large, spot instances)
resource "google_container_node_pool" "spark" {
  name    = "spark-pool"
  cluster = google_container_cluster.lakehouse.id

  autoscaling {
    min_node_count = 0
    max_node_count = 20
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 200
    disk_type    = "pd-ssd"
    spot         = true  # Use spot instances to cut costs

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env  = var.environment
      pool = "spark"
    }

    taint {
      key    = "workload"
      value  = "spark"
      effect = "NO_SCHEDULE"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}

# GPU node pool for ML workloads
resource "google_container_node_pool" "gpu" {
  name    = "gpu-pool"
  cluster = google_container_cluster.lakehouse.id

  autoscaling {
    min_node_count = 0
    max_node_count = 4
  }

  node_config {
    machine_type = "n1-standard-8"
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    guest_accelerator {
      type  = "nvidia-tesla-t4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env  = var.environment
      pool = "gpu"
    }

    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }
}

# ============================================================
# Cloud SQL (PostgreSQL - metadata store)
# ============================================================
resource "google_sql_database_instance" "lakehouse" {
  name             = "lakehouse-postgres"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = "db-custom-4-15360"
    availability_type = "REGIONAL"
    disk_size         = 100
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.lakehouse_vpc.id
    }

    database_flags {
      name  = "max_connections"
      value = "1000"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 4500
      record_application_tags = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "lakehouse" {
  name     = "lakehouse"
  instance = google_sql_database_instance.lakehouse.name
}

resource "google_sql_database" "mlflow" {
  name     = "mlflow"
  instance = google_sql_database_instance.lakehouse.name
}

# ============================================================
# GCS Buckets (Delta Lake storage)
# ============================================================
resource "google_storage_bucket" "lakehouse_data" {
  name          = "${var.project_id}-lakehouse-data"
  location      = var.region
  storage_class = "STANDARD"
  project       = var.project_id

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "mlflow_artifacts" {
  name          = "${var.project_id}-mlflow-artifacts"
  location      = var.region
  storage_class = "STANDARD"
  project       = var.project_id
}

resource "google_storage_bucket" "spark_logs" {
  name          = "${var.project_id}-spark-logs"
  location      = var.region
  storage_class = "STANDARD"
  project       = var.project_id

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# ============================================================
# Service Account & IAM
# ============================================================
resource "google_service_account" "lakehouse" {
  account_id   = "lakehouse-platform"
  display_name = "LakehousePlatform Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "lakehouse_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.lakehouse.email}"
}

resource "google_project_iam_member" "lakehouse_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.lakehouse.email}"
}

resource "google_project_iam_member" "lakehouse_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.lakehouse.email}"
}

# Workload Identity binding
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.lakehouse.name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[lakehouse/lakehouse-platform]"
  ]
}

# ============================================================
# Outputs
# ============================================================
output "gke_cluster_name" {
  value = google_container_cluster.lakehouse.name
}

output "gke_cluster_endpoint" {
  value     = google_container_cluster.lakehouse.endpoint
  sensitive = true
}

output "data_bucket" {
  value = google_storage_bucket.lakehouse_data.name
}

output "postgres_connection_name" {
  value = google_sql_database_instance.lakehouse.connection_name
}

output "service_account_email" {
  value = google_service_account.lakehouse.email
}
