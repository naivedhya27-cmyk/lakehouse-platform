"""
JupyterHub Configuration for LakehousePlatform
Custom spawner and authenticator for integration with platform services
"""
import os

c = get_config()

# Hub configuration
c.JupyterHub.ip = '0.0.0.0'
c.JupyterHub.port = 8888
c.JupyterHub.hub_ip = '0.0.0.0'

# Admin users
c.Authenticator.admin_users = {'admin'}
c.JupyterHub.admin_access = True

# Spawner - use KubeSpawner in production
if os.getenv('KUBERNETES_SERVICE_HOST'):
    c.JupyterHub.spawner_class = 'kubespawner.KubeSpawner'
    c.KubeSpawner.image = 'jupyter/pyspark-notebook:latest'
    c.KubeSpawner.namespace = os.getenv('JUPYTERHUB_NAMESPACE', 'lakehouse')
    c.KubeSpawner.service_account = 'lakehouse-platform'
    
    # Resource limits per notebook
    c.KubeSpawner.cpu_limit = 4
    c.KubeSpawner.cpu_guarantee = 0.5
    c.KubeSpawner.mem_limit = '8G'
    c.KubeSpawner.mem_guarantee = '2G'
    
    # Persistent storage
    c.KubeSpawner.storage_capacity = '10Gi'
    c.KubeSpawner.storage_pvc_ensure = True
    
    # Environment variables for Spark connection
    c.KubeSpawner.environment = {
        'SPARK_MASTER': os.getenv('SPARK_MASTER', 'spark://spark-master:7077'),
        'PYSPARK_PYTHON': 'python3',
        'LAKEHOUSE_API_URL': os.getenv('LAKEHOUSE_API_URL', 'http://lakehouse-api:8000'),
        'MLFLOW_TRACKING_URI': os.getenv('MLFLOW_TRACKING_URI', 'http://lakehouse-mlflow:5000'),
        'AWS_ACCESS_KEY_ID': os.getenv('AWS_ACCESS_KEY_ID', ''),
        'AWS_SECRET_ACCESS_KEY': os.getenv('AWS_SECRET_ACCESS_KEY', ''),
        'AWS_ENDPOINT_URL': os.getenv('AWS_ENDPOINT_URL', ''),
    }
    
    # Profile list (let users pick notebook size)
    c.KubeSpawner.profile_list = [
        {
            'display_name': 'Small (2 CPU, 4 GB)',
            'kubespawner_override': {
                'cpu_guarantee': 0.5, 'cpu_limit': 2,
                'mem_guarantee': '2G', 'mem_limit': '4G',
            }
        },
        {
            'display_name': 'Medium (4 CPU, 8 GB)',
            'kubespawner_override': {
                'cpu_guarantee': 1, 'cpu_limit': 4,
                'mem_guarantee': '4G', 'mem_limit': '8G',
            }
        },
        {
            'display_name': 'Large (8 CPU, 16 GB)',
            'kubespawner_override': {
                'cpu_guarantee': 2, 'cpu_limit': 8,
                'mem_guarantee': '8G', 'mem_limit': '16G',
            }
        },
        {
            'display_name': 'GPU (4 CPU, 16 GB + T4 GPU)',
            'kubespawner_override': {
                'cpu_guarantee': 1, 'cpu_limit': 4,
                'mem_guarantee': '8G', 'mem_limit': '16G',
                'extra_resource_limits': {'nvidia.com/gpu': '1'},
                'extra_resource_guarantees': {'nvidia.com/gpu': '1'},
                'node_selector': {'pool': 'gpu'},
                'tolerations': [{'key': 'nvidia.com/gpu', 'operator': 'Equal', 'value': 'present', 'effect': 'NoSchedule'}],
            }
        },
    ]
else:
    # Local development - simple spawner
    c.JupyterHub.spawner_class = 'simple'

# Idle culling (stop inactive notebooks after 2 hours)
c.JupyterHub.services = [
    {
        'name': 'cull-idle',
        'admin': True,
        'command': ['python3', '-m', 'jupyterhub_idle_culler', '--timeout=7200'],
    }
]

# Cookie secret
c.JupyterHub.cookie_secret_file = '/srv/jupyterhub/cookie_secret'

# Database
c.JupyterHub.db_url = os.getenv('JUPYTERHUB_DB_URL', 'sqlite:///jupyterhub.sqlite')
