-- LakehousePlatform Database Initialization

-- Create databases
CREATE DATABASE mlflow;
CREATE DATABASE keycloak;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS compute;
CREATE SCHEMA IF NOT EXISTS jobs;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE lakehouse TO lakehouse;
GRANT ALL PRIVILEGES ON DATABASE mlflow TO lakehouse;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO lakehouse;
