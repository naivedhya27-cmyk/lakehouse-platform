import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  BeakerIcon,
  ChartBarIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  TagIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Experiment {
  experiment_id: string;
  name: string;
  artifact_location?: string;
  lifecycle_stage: string;
  tags?: Record<string, string>;
}

interface RegisteredModel {
  name: string;
  latest_versions?: { version: string; current_stage: string; source: string }[];
  description?: string;
  tags?: Record<string, string>;
}

const stages = ['None', 'Staging', 'Production', 'Archived'];
const stageColors: Record<string, string> = {
  None: 'bg-gray-100 text-gray-700',
  Staging: 'bg-yellow-100 text-yellow-700',
  Production: 'bg-green-100 text-green-700',
  Archived: 'bg-red-100 text-red-700',
};

export default function MLExperiments() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'experiments' | 'models'>('experiments');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: experiments, isLoading: expLoading } = useQuery({
    queryKey: ['experiments'],
    queryFn: () => api.get('/api/2.0/mlflow/experiments/list').then(r => r.data.experiments),
    enabled: activeTab === 'experiments',
  });

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.get('/api/2.0/mlflow/registered-models/list').then(r => r.data.registered_models),
    enabled: activeTab === 'models',
  });

  const createExpMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/2.0/mlflow/experiments/create', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      setShowCreateModal(false);
      setNewName('');
      toast.success('Experiment created');
    },
  });

  const createModelMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/2.0/mlflow/registered-models/create', { name, source: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setShowCreateModal(false);
      setNewName('');
      toast.success('Model registered');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ML & AI</h1>
          <p className="text-sm text-gray-500 mt-1">Experiment tracking, model registry, and distributed training</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
          <PlusIcon className="h-4 w-4" />
          {activeTab === 'experiments' ? 'New Experiment' : 'Register Model'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <BeakerIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{experiments?.length || 0}</p>
              <p className="text-xs text-gray-500">Experiments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CubeIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{models?.length || 0}</p>
              <p className="text-xs text-gray-500">Registered Models</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500">Production Models</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <ChartBarIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500">Total Runs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('experiments')}
          className={clsx('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'experiments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
          Experiments
        </button>
        <button onClick={() => setActiveTab('models')}
          className={clsx('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'models' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
          Model Registry
        </button>
      </div>

      {/* Experiments */}
      {activeTab === 'experiments' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {expLoading ? (
            <div className="p-12 text-center text-gray-400">Loading experiments...</div>
          ) : !experiments?.length ? (
            <div className="p-12 text-center">
              <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-2 text-gray-500">No experiments yet</p>
              <button onClick={() => setShowCreateModal(true)}
                className="mt-3 text-sm text-indigo-600 font-medium">Create your first experiment</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {experiments.map((exp: Experiment) => (
                <div key={exp.experiment_id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <BeakerIcon className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{exp.name}</p>
                      <p className="text-xs text-gray-500">ID: {exp.experiment_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={clsx('text-xs px-2 py-1 rounded-full',
                      exp.lifecycle_stage === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                      {exp.lifecycle_stage}
                    </span>
                    <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View Runs</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Registry */}
      {activeTab === 'models' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {modelsLoading ? (
            <div className="p-12 text-center text-gray-400">Loading models...</div>
          ) : !models?.length ? (
            <div className="p-12 text-center">
              <CubeIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-2 text-gray-500">No registered models</p>
              <button onClick={() => setShowCreateModal(true)}
                className="mt-3 text-sm text-indigo-600 font-medium">Register a model</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {models.map((model: RegisteredModel) => (
                <div key={model.name} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <CubeIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{model.name}</p>
                        <p className="text-xs text-gray-500">{model.description || 'No description'}</p>
                      </div>
                    </div>
                  </div>
                  {model.latest_versions && model.latest_versions.length > 0 && (
                    <div className="mt-3 flex gap-2 pl-14">
                      {model.latest_versions.map((v) => (
                        <span key={v.version}
                          className={clsx('text-xs px-2 py-1 rounded-full font-medium', stageColors[v.current_stage] || stageColors.None)}>
                          v{v.version} — {v.current_stage}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {activeTab === 'experiments' ? 'Create Experiment' : 'Register Model'}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder={activeTab === 'experiments' ? 'fraud-detection-v2' : 'customer-churn-model'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button disabled={!newName}
                onClick={() => activeTab === 'experiments' ? createExpMutation.mutate(newName) : createModelMutation.mutate(newName)}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {activeTab === 'experiments' ? 'Create' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
