import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  BoltIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

const pipelineStates: Record<string, { color: string; label: string }> = {
  RUNNING: { color: 'bg-green-100 text-green-700', label: 'Running' },
  CREATED: { color: 'bg-blue-100 text-blue-700', label: 'Created' },
  PAUSED: { color: 'bg-yellow-100 text-yellow-700', label: 'Paused' },
  STOPPED: { color: 'bg-gray-100 text-gray-700', label: 'Stopped' },
  FAILED: { color: 'bg-red-100 text-red-700', label: 'Failed' },
};

export default function Streaming() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPipeline, setNewPipeline] = useState({
    name: '',
    sourceType: 'kafka',
    sourceTopic: '',
    sinkType: 'delta',
    sinkTable: '',
    triggerInterval: '10 seconds',
  });

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/api/2.0/streaming/pipelines').then(r => r.data.pipelines),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (pipeline: any) => api.post('/api/2.0/streaming/pipelines', pipeline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setShowCreateModal(false);
      toast.success('Pipeline created');
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/2.0/streaming/pipelines/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline started');
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/2.0/streaming/pipelines/${id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast.success('Pipeline stopped');
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: newPipeline.name,
      source: { type: newPipeline.sourceType, config: { topic: newPipeline.sourceTopic } },
      sink: { type: newPipeline.sinkType, config: { table: newPipeline.sinkTable } },
      trigger_interval: newPipeline.triggerInterval,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Streaming Pipelines</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time data pipelines with Apache Flink and Kafka</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
          <PlusIcon className="h-4 w-4" /> New Pipeline
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
            <SignalIcon className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pipelines?.filter((p: any) => p.state === 'RUNNING').length || 0}</p>
            <p className="text-sm text-gray-500">Active Pipelines</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <BoltIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-sm text-gray-500">Events/sec</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
            <ArrowPathIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pipelines?.length || 0}</p>
            <p className="text-sm text-gray-500">Total Pipelines</p>
          </div>
        </div>
      </div>

      {/* Pipeline List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading pipelines...</div>
        ) : !pipelines?.length ? (
          <div className="p-12 text-center">
            <BoltIcon className="h-12 w-12 text-gray-300 mx-auto" />
            <p className="mt-2 text-gray-500">No streaming pipelines configured</p>
            <button onClick={() => setShowCreateModal(true)}
              className="mt-3 text-sm text-indigo-600 font-medium">Create your first pipeline</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pipelines.map((pipeline: any) => (
              <div key={pipeline.pipeline_id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <BoltIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{pipeline.name || pipeline.pipeline_id}</p>
                    <p className="text-xs text-gray-500">
                      {pipeline.source?.type || 'kafka'} → {pipeline.sink?.type || 'delta'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium',
                    pipelineStates[pipeline.state]?.color || 'bg-gray-100 text-gray-700')}>
                    {pipelineStates[pipeline.state]?.label || pipeline.state}
                  </span>
                  {pipeline.state === 'RUNNING' ? (
                    <button onClick={() => stopMutation.mutate(pipeline.pipeline_id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><StopIcon className="h-4 w-4" /></button>
                  ) : (
                    <button onClick={() => startMutation.mutate(pipeline.pipeline_id)}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"><PlayIcon className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Pipeline Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Streaming Pipeline</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Name</label>
                <input type="text" value={newPipeline.name}
                  onChange={e => setNewPipeline(p => ({ ...p, name: e.target.value }))}
                  placeholder="user-events-to-delta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                  <select value={newPipeline.sourceType}
                    onChange={e => setNewPipeline(p => ({ ...p, sourceType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="kafka">Kafka</option>
                    <option value="kinesis">Kinesis</option>
                    <option value="s3">S3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Topic/Path</label>
                  <input type="text" value={newPipeline.sourceTopic}
                    onChange={e => setNewPipeline(p => ({ ...p, sourceTopic: e.target.value }))}
                    placeholder="user_events"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sink Type</label>
                  <select value={newPipeline.sinkType}
                    onChange={e => setNewPipeline(p => ({ ...p, sinkType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="delta">Delta Lake</option>
                    <option value="kafka">Kafka</option>
                    <option value="bigquery">BigQuery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sink Table/Topic</label>
                  <input type="text" value={newPipeline.sinkTable}
                    onChange={e => setNewPipeline(p => ({ ...p, sinkTable: e.target.value }))}
                    placeholder="main.default.user_events"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Interval</label>
                <select value={newPipeline.triggerInterval}
                  onChange={e => setNewPipeline(p => ({ ...p, triggerInterval: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="1 second">1 second</option>
                  <option value="5 seconds">5 seconds</option>
                  <option value="10 seconds">10 seconds</option>
                  <option value="30 seconds">30 seconds</option>
                  <option value="1 minute">1 minute</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={!newPipeline.name}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create Pipeline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
