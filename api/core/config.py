"""
Core Configuration - Application settings via environment variables
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "LakehousePlatform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    TESTING: bool = False
    SECRET_KEY: str = "changeme-in-production"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    
    # Database
    DATABASE_URL: str = "postgresql://lakehouse:lakehouse@localhost:5432/lakehouse"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Object Storage (S3/MinIO/GCS/Azure)
    STORAGE_TYPE: str = "s3"  # s3, gcs, azure, local
    STORAGE_ROOT: str = "s3://lakehouse-data"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_ENDPOINT_URL: Optional[str] = None  # For MinIO
    
    # GCS
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    
    # Azure
    AZURE_STORAGE_ACCOUNT_NAME: Optional[str] = None
    AZURE_STORAGE_ACCOUNT_KEY: Optional[str] = None
    
    # Spark
    SPARK_MASTER: str = "k8s://https://kubernetes.default.svc"
    SPARK_IMAGE: str = "ghcr.io/lakehouse-platform/spark:3.5.0"
    SPARK_NAMESPACE: str = "lakehouse-compute"
    
    # Trino
    TRINO_HOST: str = "trino"
    TRINO_PORT: int = 8080
    
    # MLflow
    MLFLOW_TRACKING_URI: str = "http://mlflow:5000"
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"
    
    # Keycloak (Authentication)
    KEYCLOAK_URL: str = "http://keycloak:8080"
    KEYCLOAK_REALM: str = "lakehouse"
    KEYCLOAK_CLIENT_ID: str = "lakehouse-api"
    KEYCLOAK_CLIENT_SECRET: Optional[str] = None
    
    # Monitoring
    ENABLE_METRICS: bool = True
    PROMETHEUS_PORT: int = 9090
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
