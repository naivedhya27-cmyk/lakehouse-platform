import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  TrashIcon,
  CpuChipIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';

interface Cluster {
  cluster_id: string;
  cluster_name: string;
  state: string;
  num_workers: number;
  spark_version: string;
  node_type_id: string;
  creator_user_name?: string;
  start_time?: number;
}

const stateColors: Record<string, string> = {
  RUNNING: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  TERMINATED: 'bg-gray-100 text-gray-800',
  ERROR: 'bg-red-100 text-red-800',
  RESTARTING: 'bg-blue-100 text-blue-800',
  RESIZING: 'bg-purple-100 text-purple-800',
  TERMINATING: 'bg-orange-100 text-orange-800',
};

const sparkVersions = ['3.5.0', '3.4.2', '3.4.1', '3.3.4'];
const nodeTypes = [
  { id: 'Standard_2vCPU_8GB', label: '2 vCPU, 8 GB (Small)' },
  { id: 'Standard_4vCPU_16GB', label: '4 vCPU, 16 GB (Medium)' },
  { id: 'Standard_8vCPU_32GB', label: '8 vCPU, 32 GB (Large)' },
  { id: 'Standard_16vCPU_64GB', label: '16 vCPU, 64 GB (X-Large)' },
  { id: 'GPU_T4_4vCPU_16GB', label: 'GPU T4, 4 vCPU, 16 GB' },
];

export default function Clusters() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCluster, setNewCluster] = useState({
    cluster_name: '',
    spark_version: '3.5.0',
    node_type_id: 'Standard_4vCPU_16GB',
    num_workers: 2,
    enable_autoscale: false,
    min_workers: 1,
    max_workers: 10,
  });

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => api.get('/api/2.0/clusters/list').then(r => r.data.clusters),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (spec: any) => api.post('/api/2.0/clusters/create', spec),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      setShowCreateModal(false);
      toast.success('Cluster creation started');
    },
    onError: () => toast.error('Failed to create cluster'),
  });

  const startMutation = useMutation({
    mutationFn: (clusterId: string) => api.post('/api/2.0/clusters/start', { cluster_id: clusterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      toast.success('Cluster starting...');
    },
  });

  const terminateMutation = useMutation({
    mutationFn: (clusterId: string) => api.post('/api/2.0/clusters/delete', { cluster_id: clusterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      toast.success('Cluster terminated');
    },
  });

  const restartMutation = useMutation({
    mutationFn: (clusterId: string) => api.post('/api/2.0/clusters/restart', { cluster_id: clusterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      toast.success('Cluster restarting...');
    },
  });

  const handleCreate = () => {
    const spec: any = {
      cluster_name: newCluster.cluster_name,
      spark_version: newCluster.spark_version,
      node_type_id: newCluster.node_type_id,
    };
    if (newCluster.enable_autoscale) {
      spec.autoscale = { min_workers: newCluster.min_workers, max_workers: newCluster.max_workers };
    } else {
      spec.num_workers = newCluster.num_workers;
    }
    createMutation.mutate(spec);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compute Clusters</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Apache Spark clusters on Kubernetes</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Create Cluster
        </button>
      </div>

      {/* Clusters Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spark</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading clusters...</td></tr>
            ) : !clusters?.length ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <CpuChipIcon className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No clusters yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    Create your first cluster
                  </button>
                </td>
              </tr>
            ) : (
              clusters.map((cluster: Cluster) => (
                <tr key={cluster.cluster_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cluster.cluster_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{cluster.cluster_id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', stateColors[cluster.state] || 'bg-gray-100 text-gray-800')}>
                      {cluster.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{cluster.num_workers}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{cluster.spark_version}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{cluster.node_type_id}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {cluster.state === 'TERMINATED' && (
                      <button onClick={() => startMutation.mutate(cluster.cluster_id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Start">
                        <PlayIcon className="h-4 w-4" />
                      </button>
                    )}
                    {cluster.state === 'RUNNING' && (
                      <>
                        <button onClick={() => restartMutation.mutate(cluster.cluster_id)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Restart">
                          <ArrowPathIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => terminateMutation.mutate(cluster.cluster_id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Terminate">
                          <StopIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button onClick={() => terminateMutation.mutate(cluster.cluster_id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Delete">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Cluster Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Cluster</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cluster Name</label>
                <input
                  type="text"
                  value={newCluster.cluster_name}
                  onChange={e => setNewCluster(p => ({ ...p, cluster_name: e.target.value }))}
                  placeholder="my-spark-cluster"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spark Version</label>
                  <select
                    value={newCluster.spark_version}
                    onChange={e => setNewCluster(p => ({ ...p, spark_version: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {sparkVersions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Node Type</label>
                  <select
                    value={newCluster.node_type_id}
                    onChange={e => setNewCluster(p => ({ ...p, node_type_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {nodeTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newCluster.enable_autoscale}
                  onChange={e => setNewCluster(p => ({ ...p, enable_autoscale: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <label className="text-sm text-gray-700">Enable Autoscaling</label>
              </div>
              {newCluster.enable_autoscale ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Workers</label>
                    <input type="number" min={1} value={newCluster.min_workers}
                      onChange={e => setNewCluster(p => ({ ...p, min_workers: +e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Workers</label>
                    <input type="number" min={1} value={newCluster.max_workers}
                      onChange={e => setNewCluster(p => ({ ...p, max_workers: +e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Workers</label>
                  <input type="number" min={0} value={newCluster.num_workers}
                    onChange={e => setNewCluster(p => ({ ...p, num_workers: +e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!newCluster.cluster_name || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create Cluster'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
