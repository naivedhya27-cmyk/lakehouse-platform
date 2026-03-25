import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CalendarIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface Job {
  job_id: number;
  name: string;
  tasks: any[];
  schedule?: { quartz_cron_expression: string; pause_status: string };
  created_at?: string;
}

interface JobRun {
  run_id: number;
  state: { life_cycle_state: string; result_state?: string; state_message: string };
  start_time: number;
  execution_duration: number;
}

const stateIcons: Record<string, { icon: any; color: string }> = {
  SUCCESS: { icon: CheckCircleIcon, color: 'text-green-500' },
  FAILED: { icon: XCircleIcon, color: 'text-red-500' },
  RUNNING: { icon: ArrowPathIcon, color: 'text-blue-500 animate-spin' },
  PENDING: { icon: ClockIcon, color: 'text-yellow-500' },
  CANCELED: { icon: PauseIcon, color: 'text-gray-500' },
};

export default function Jobs() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'runs'>('jobs');
  const [newJob, setNewJob] = useState({
    name: '',
    taskKey: '',
    notebookPath: '',
    clusterId: '',
    cronExpression: '',
    enableSchedule: false,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/api/2.0/jobs/list').then(r => r.data.jobs),
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['job-runs', selectedJob],
    queryFn: () => api.get('/api/2.0/jobs/runs/list', { params: { job_id: selectedJob } }).then(r => r.data.runs),
    enabled: activeTab === 'runs',
    refetchInterval: 5000,
  });

  const createJobMutation = useMutation({
    mutationFn: (job: any) => api.post('/api/2.0/jobs/create', job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setShowCreateModal(false);
      toast.success('Job created successfully');
    },
  });

  const runNowMutation = useMutation({
    mutationFn: (jobId: number) => api.post('/api/2.0/jobs/run-now', { job_id: jobId }),
    onSuccess: (resp) => {
      toast.success(`Run ${resp.data.run_id} started`);
      setActiveTab('runs');
      queryClient.invalidateQueries({ queryKey: ['job-runs'] });
    },
  });

  const handleCreate = () => {
    const job: any = {
      name: newJob.name,
      tasks: [{
        task_key: newJob.taskKey || 'main',
        notebook_task: { notebook_path: newJob.notebookPath },
        existing_cluster_id: newJob.clusterId || undefined,
      }],
    };
    if (newJob.enableSchedule && newJob.cronExpression) {
      job.schedule = { quartz_cron_expression: newJob.cronExpression, timezone_id: 'UTC' };
    }
    createJobMutation.mutate(job);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and orchestrate Spark jobs and notebook runs</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
          <PlusIcon className="h-4 w-4" /> Create Job
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('jobs')}
          className={clsx('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'jobs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          All Jobs
        </button>
        <button onClick={() => setActiveTab('runs')}
          className={clsx('px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === 'runs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          Job Runs
        </button>
      </div>

      {/* Jobs List */}
      {activeTab === 'jobs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {jobsLoading ? (
            <div className="p-12 text-center text-gray-400">Loading jobs...</div>
          ) : !jobs?.length ? (
            <div className="p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-2 text-gray-500">No jobs created yet</p>
              <button onClick={() => setShowCreateModal(true)}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium">
                Create your first job
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobs.map((job: Job) => (
                <div key={job.job_id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <CalendarIcon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{job.name}</p>
                      <p className="text-xs text-gray-500">
                        {job.tasks?.length || 0} task(s)
                        {job.schedule && ` · Scheduled: ${job.schedule.quartz_cron_expression}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => runNowMutation.mutate(job.job_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                      <PlayIcon className="h-3.5 w-3.5" /> Run Now
                    </button>
                    <button onClick={() => { setSelectedJob(job.job_id); setActiveTab('runs'); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runs List */}
      {activeTab === 'runs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {runsLoading ? (
            <div className="p-12 text-center text-gray-400">Loading runs...</div>
          ) : !runs?.length ? (
            <div className="p-12 text-center text-gray-400">
              <ArrowPathIcon className="h-12 w-12 mx-auto mb-2" />
              <p>No runs to display</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Run ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run: JobRun) => {
                  const state = run.state?.result_state || run.state?.life_cycle_state || 'PENDING';
                  const StateIcon = stateIcons[state]?.icon || ClockIcon;
                  const stateColor = stateIcons[state]?.color || 'text-gray-400';
                  return (
                    <tr key={run.run_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-mono text-gray-700">{run.run_id}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <StateIcon className={`h-4 w-4 ${stateColor}`} />
                          <span className="text-sm text-gray-700">{state}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{new Date(run.start_time).toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{Math.round(run.execution_duration / 1000)}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Job</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Name</label>
                <input type="text" value={newJob.name}
                  onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                  placeholder="Daily ETL Pipeline"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notebook Path</label>
                <input type="text" value={newJob.notebookPath}
                  onChange={e => setNewJob(p => ({ ...p, notebookPath: e.target.value }))}
                  placeholder="/ETL/my_notebook"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={newJob.enableSchedule}
                  onChange={e => setNewJob(p => ({ ...p, enableSchedule: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600" />
                <label className="text-sm text-gray-700">Enable Schedule</label>
              </div>
              {newJob.enableSchedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
                  <input type="text" value={newJob.cronExpression}
                    onChange={e => setNewJob(p => ({ ...p, cronExpression: e.target.value }))}
                    placeholder="0 0 6 * * ? (daily at 6 AM)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={!newJob.name}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
