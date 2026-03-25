# LakehousePlatform - AWS Terraform Configuration
# Provisions: EKS cluster, RDS PostgreSQL, S3 buckets, VPC, IAM

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }

  backend "s3" {
    bucket = "lakehouse-terraform-state"
    key    = "aws/prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "cluster_name" {
  default = "lakehouse-prod"
}

variable "environment" {
  default = "prod"
}

# ============================================================
# VPC
# ============================================================
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "lakehouse-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                     = 1
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"            = 1
    "karpenter.sh/discovery"                     = var.cluster_name
  }
}

# ============================================================
# EKS Cluster
# ============================================================
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  enable_cluster_creator_admin_permissions = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent    = true
      before_compute = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    core = {
      name           = "core-nodes"
      instance_types = ["m6i.xlarge"]
      min_size       = 2
      max_size       = 6
      desired_size   = 2

      labels = {
        pool = "core"
      }
    }

    spark = {
      name           = "spark-nodes"
      instance_types = ["r6i.4xlarge"]
      min_size       = 0
      max_size       = 20
      desired_size   = 0
      capacity_type  = "SPOT"

      labels = {
        pool = "spark"
      }

      taints = [
        {
          key    = "workload"
          value  = "spark"
          effect = "NO_SCHEDULE"
        }
      ]
    }

    gpu = {
      name           = "gpu-nodes"
      instance_types = ["g4dn.xlarge"]
      min_size       = 0
      max_size       = 4
      desired_size   = 0
      ami_type       = "AL2_x86_64_GPU"

      labels = {
        pool = "gpu"
      }

      taints = [
        {
          key    = "nvidia.com/gpu"
          value  = "present"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }

  tags = {
    Environment = var.environment
    Platform    = "LakehousePlatform"
  }
}

# ============================================================
# RDS PostgreSQL
# ============================================================
resource "aws_db_subnet_group" "lakehouse" {
  name       = "lakehouse-db"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name_prefix = "lakehouse-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }
}

resource "aws_db_instance" "lakehouse" {
  identifier        = "lakehouse-postgres"
  engine            = "postgres"
  engine_version    = "15.5"
  instance_class    = "db.r6g.large"
  allocated_storage = 100
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "lakehouse"
  username = "lakehouse"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.lakehouse.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az               = true
  backup_retention_period = 30
  deletion_protection     = true

  performance_insights_enabled = true

  tags = {
    Environment = var.environment
  }
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# ============================================================
# S3 Buckets
# ============================================================
resource "aws_s3_bucket" "lakehouse_data" {
  bucket = "lakehouse-data-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "lakehouse_data" {
  bucket = aws_s3_bucket.lakehouse_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lakehouse_data" {
  bucket = aws_s3_bucket.lakehouse_data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "mlflow_artifacts" {
  bucket = "lakehouse-mlflow-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "spark_logs" {
  bucket = "lakehouse-spark-logs-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "spark_logs" {
  bucket = aws_s3_bucket.spark_logs.id
  rule {
    id     = "delete-old-logs"
    status = "Enabled"
    expiration {
      days = 30
    }
  }
}

# ============================================================
# IAM Role for Pods (IRSA)
# ============================================================
module "lakehouse_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "lakehouse-platform"

  role_policy_arns = {
    s3_full     = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["lakehouse:lakehouse-platform"]
    }
  }
}

data "aws_caller_identity" "current" {}

# ============================================================
# Outputs
# ============================================================
output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = true
}

output "data_bucket" {
  value = aws_s3_bucket.lakehouse_data.bucket
}

output "rds_endpoint" {
  value     = aws_db_instance.lakehouse.endpoint
  sensitive = true
}
