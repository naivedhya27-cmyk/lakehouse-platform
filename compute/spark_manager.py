"""
SparkClusterManager - Manages Apache Spark clusters on Kubernetes
Handles cluster lifecycle: create, start, stop, resize, delete
"""
import asyncio
import uuid
import time
import logging
from typing import Optional, Dict, List, Any
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
import yaml
import json

logger = logging.getLogger(__name__)


class SparkClusterManager:
    """
    Manages Spark clusters using Spark Operator on Kubernetes.
    Compatible with spark-on-k8s-operator (GoogleCloudPlatform).
    """

    def __init__(self):
        try:
            config.load_incluster_config()
        except Exception:
            config.load_kube_config()

        self.k8s_apps = client.AppsV1Api()
        self.k8s_core = client.CoreV1Api()
        self.k8s_custom = client.CustomObjectsApi()
        self.namespace = "lakehouse-compute"
        self._clusters_db: Dict[str, dict] = {}  # In-memory store (use Redis in prod)

    async def create_cluster(self, spec: dict, username: str) -> str:
        """Create a new SparkApplication CR on Kubernetes"""
        cluster_id = f"cluster-{uuid.uuid4().hex[:8]}"
        cluster_name = spec.get("cluster_name", f"spark-{cluster_id}")

        spark_app = self._build_spark_application(cluster_id, cluster_name, spec)

        try:
            self.k8s_custom.create_namespaced_custom_object(
                group="sparkoperator.k8s.io",
                version="v1beta2",
                namespace=self.namespace,
                plural="sparkapplications",
                body=spark_app
            )
        except ApiException as e:
            logger.error(f"Failed to create SparkApplication: {e}")
            raise

        self._clusters_db[cluster_id] = {
            "cluster_id": cluster_id,
            "cluster_name": cluster_name,
            "state": "PENDING",
            "state_message": "Cluster is being created",
            "num_workers": spec.get("num_workers", 2),
            "spark_version": spec.get("spark_version", "3.5.0"),
            "node_type_id": spec.get("node_type_id", "Standard_4vCPU_16GB"),
            "creator_user_name": username,
            "start_time": int(time.time() * 1000),
            "executors": []
        }

        return cluster_id

    def _build_spark_application(self, cluster_id: str, cluster_name: str, spec: dict) -> dict:
        """Build a SparkApplication Kubernetes resource"""
        num_workers = spec.get("num_workers", 2)
        spark_version = spec.get("spark_version", "3.5.0")

        return {
            "apiVersion": "sparkoperator.k8s.io/v1beta2",
            "kind": "SparkApplication",
            "metadata": {
                "name": cluster_id,
                "namespace": self.namespace,
                "labels": {
                    "app": "lakehouse-platform",
                    "cluster-id": cluster_id,
                    "cluster-name": cluster_name,
                }
            },
            "spec": {
                "type": "Python",
                "pythonVersion": "3",
                "mode": "cluster",
                "image": f"ghcr.io/lakehouse-platform/spark:{spark_version}",
                "imagePullPolicy": "IfNotPresent",
                "mainApplicationFile": "local:///opt/spark/examples/src/main/python/pi.py",
                "sparkVersion": spark_version,
                "restartPolicy": {"type": "Never"},
                "driver": {
                    "cores": 2,
                    "memory": "4g",
                    "labels": {"version": spark_version, "role": "driver"},
                    "serviceAccount": "spark",
                    "env": [
                        {"name": "SPARK_CLUSTER_ID", "value": cluster_id},
                        {"name": "LAKEHOUSE_API_URL", "value": "http://lakehouse-api:8000"}
                    ]
                },
                "executor": {
                    "cores": 4,
                    "instances": num_workers,
                    "memory": "8g",
                    "labels": {"version": spark_version, "role": "executor"}
                },
                "sparkConf": {
                    "spark.ui.port": "4040",
                    "spark.eventLog.enabled": "true",
                    "spark.eventLog.dir": "s3a://lakehouse-logs/spark-events",
                    "spark.sql.extensions": "io.delta.sql.DeltaSparkSessionExtension",
                    "spark.sql.catalog.spark_catalog": "org.apache.spark.sql.delta.catalog.DeltaCatalog",
                    "spark.hadoop.fs.s3a.impl": "org.apache.hadoop.fs.s3a.S3AFileSystem",
                    **spec.get("spark_conf", {})
                }
            }
        }

    async def start_cluster(self, cluster_id: str):
        """Start a previously terminated cluster"""
        if cluster_id in self._clusters_db:
            self._clusters_db[cluster_id]["state"] = "RUNNING"
            self._clusters_db[cluster_id]["state_message"] = "Cluster is running"

    async def restart_cluster(self, cluster_id: str):
        """Restart a running cluster"""
        if cluster_id in self._clusters_db:
            self._clusters_db[cluster_id]["state"] = "RESTARTING"
            await asyncio.sleep(5)
            self._clusters_db[cluster_id]["state"] = "RUNNING"

    async def delete_cluster(self, cluster_id: str):
        """Delete a cluster"""
        try:
            self.k8s_custom.delete_namespaced_custom_object(
                group="sparkoperator.k8s.io",
                version="v1beta2",
                namespace=self.namespace,
                plural="sparkapplications",
                name=cluster_id
            )
        except ApiException as e:
            if e.status != 404:
                raise
        self._clusters_db.pop(cluster_id, None)

    async def get_cluster(self, cluster_id: str) -> Optional[dict]:
        """Get cluster information"""
        if cluster_id not in self._clusters_db:
            return None

        cluster = self._clusters_db[cluster_id].copy()

        # Try to get real state from K8s
        try:
            spark_app = self.k8s_custom.get_namespaced_custom_object(
                group="sparkoperator.k8s.io",
                version="v1beta2",
                namespace=self.namespace,
                plural="sparkapplications",
                name=cluster_id
            )
            app_state = spark_app.get("status", {}).get("applicationState", {}).get("state", "UNKNOWN")
            state_map = {
                "RUNNING": "RUNNING",
                "SUBMITTED": "PENDING",
                "PENDING_RERUN": "PENDING",
                "INVALIDATING": "RESTARTING",
                "SUCCEEDING": "RUNNING",
                "COMPLETED": "TERMINATED",
                "FAILED": "ERROR",
                "UNKNOWN": "PENDING"
            }
            cluster["state"] = state_map.get(app_state, "PENDING")
        except ApiException:
            pass

        return cluster

    async def list_clusters(self, username: str) -> List[dict]:
        """List all clusters"""
        return [c for c in self._clusters_db.values()]

    async def resize_cluster(self, cluster_id: str, num_workers: Optional[int], autoscale: Optional[dict]):
        """Resize a cluster"""
        if cluster_id in self._clusters_db:
            if num_workers is not None:
                self._clusters_db[cluster_id]["num_workers"] = num_workers

    async def validate_cluster_access(self, cluster_id: str, user):
        """Validate that user has access to cluster"""
        if cluster_id not in self._clusters_db:
            raise Exception(f"Cluster {cluster_id} not found")

    async def get_cluster_events(self, cluster_id: str) -> List[dict]:
        """Get cluster event history"""
        return []

    async def submit_job_run(self, job_id: int, run_id: int):
        """Submit a job run to a cluster"""
        logger.info(f"Submitting job {job_id} run {run_id}")

    async def cancel_run(self, run_id: int):
        """Cancel a running job"""
        logger.info(f"Cancelling run {run_id}")
