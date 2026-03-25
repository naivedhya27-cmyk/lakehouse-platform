import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  ServerStackIcon,
  CpuChipIcon,
  CircleStackIcon,
  BeakerIcon,
  ChartBarIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

const stats = [
  { name: 'Active Clusters', icon: ServerStackIcon, key: 'clusters' },
  { name: 'Running Jobs', icon: CpuChipIcon, key: 'jobs' },
  { name: 'Delta Tables', icon: CircleStackIcon, key: 'tables' },
  { name: 'ML Experiments', icon: BeakerIcon, key: 'experiments' },
  { name: 'SQL Queries (24h)', icon: ChartBarIcon, key: 'queries' },
  { name: 'Stream Pipelines', icon: BoltIcon, key: 'pipelines' },
];

export default function Dashboard() {
  const { data: platformInfo } = useQuery({
    queryKey: ['platform-info'],
    queryFn: () => api.get('/api/2.0/info').then(r => r.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">LakehousePlatform Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
              </div>
              <stat.icon className="h-10 w-10 text-indigo-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Platform Info */}
      {platformInfo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Components</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(platformInfo.components || {}).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase">{key}</p>
                <p className="text-sm text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            New Cluster
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            New Notebook
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            SQL Editor
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            New ML Experiment
          </button>
        </div>
      </div>
    </div>
  );
}
