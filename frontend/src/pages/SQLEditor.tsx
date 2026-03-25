import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import {
  PlayIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

interface QueryResult {
  statement_id: string;
  status: { state: string; error?: { message: string } };
  manifest?: { schema: { columns: { name: string; type_name: string }[] } };
  result?: { row_count: number; data_array: any[][] };
}

const sampleQueries = [
  { label: 'Show Tables', sql: 'SHOW TABLES' },
  { label: 'Describe Table', sql: 'DESCRIBE main.default.my_table' },
  { label: 'Sample Query', sql: 'SELECT * FROM main.default.events LIMIT 100' },
  { label: 'Aggregation', sql: `SELECT date_trunc('hour', event_time) AS hour,\n       COUNT(*) AS event_count,\n       COUNT(DISTINCT user_id) AS unique_users\nFROM main.default.events\nWHERE event_date >= CURRENT_DATE - INTERVAL '7' DAY\nGROUP BY 1\nORDER BY 1 DESC` },
];

export default function SQLEditor() {
  const [query, setQuery] = useState('SELECT 1 AS test_column, \'hello\' AS greeting');
  const [warehouse, setWarehouse] = useState('wh-default');
  const [catalog, setCatalog] = useState('main');
  const [schema, setSchema] = useState('default');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<{sql: string; time: string; status: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'history'>('results');

  const executeMutation = useMutation({
    mutationFn: (sql: string) => api.post('/api/2.0/sql/statements', {
      statement: sql,
      warehouse_id: warehouse,
      catalog,
      schema_name: schema,
      row_limit: 1000,
    }),
    onSuccess: (resp) => {
      setResult(resp.data);
      setQueryHistory(prev => [{
        sql: query.substring(0, 100),
        time: new Date().toLocaleTimeString(),
        status: resp.data.status.state
      }, ...prev.slice(0, 49)]);
      if (resp.data.status.state === 'SUCCEEDED') {
        toast.success(`Query returned ${resp.data.result?.row_count || 0} rows`);
      } else if (resp.data.status.state === 'FAILED') {
        toast.error(resp.data.status.error?.message || 'Query failed');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Query execution failed'),
  });

  const handleRun = useCallback(() => {
    if (!query.trim()) return;
    executeMutation.mutate(query);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">SQL Editor</h1>
          <div className="flex items-center gap-2 ml-4">
            <select value={catalog} onChange={e => setCatalog(e.target.value)}
              className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
              <option value="main">main</option>
              <option value="hive_metastore">hive_metastore</option>
            </select>
            <span className="text-gray-400">.</span>
            <select value={schema} onChange={e => setSchema(e.target.value)}
              className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
              <option value="default">default</option>
              <option value="analytics">analytics</option>
              <option value="raw">raw</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <option value="wh-default">Default Warehouse (Small)</option>
            <option value="wh-large">Large Warehouse</option>
          </select>
          <button onClick={handleRun} disabled={executeMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm">
            <PlayIcon className="h-4 w-4" />
            {executeMutation.isPending ? 'Running...' : 'Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {/* Sample Queries */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Templates:</span>
        {sampleQueries.map(sq => (
          <button key={sq.label} onClick={() => setQuery(sq.sql)}
            className="px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">
            {sq.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-shrink-0">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-40 px-4 py-3 font-mono text-sm bg-gray-900 text-green-400 rounded-xl border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          placeholder="Enter your SQL query..."
          spellCheck={false}
        />
      </div>

      {/* Results Panel */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <button onClick={() => setActiveTab('results')}
            className={clsx('px-3 py-2.5 text-sm font-medium border-b-2 transition-colors', activeTab === 'results' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <TableCellsIcon className="h-4 w-4 inline mr-1.5" />
            Results {result?.result?.row_count !== undefined && `(${result.result.row_count})`}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={clsx('px-3 py-2.5 text-sm font-medium border-b-2 transition-colors', activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <ClockIcon className="h-4 w-4 inline mr-1.5" />
            History ({queryHistory.length})
          </button>
        </div>

        {/* Results Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'results' && (
            <>
              {!result && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <TableCellsIcon className="h-12 w-12 mx-auto mb-2" />
                    <p>Run a query to see results</p>
                  </div>
                </div>
              )}
              {result?.status.state === 'FAILED' && (
                <div className="p-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800">Query Failed</p>
                    <p className="text-sm text-red-600 mt-1">{result.status.error?.message}</p>
                  </div>
                </div>
              )}
              {result?.status.state === 'SUCCEEDED' && result.result?.data_array && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">#</th>
                      {result.manifest?.schema.columns.map((col, i) => (
                        <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {col.name} <span className="text-gray-400 normal-case">({col.type_name})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.result.data_array.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-1.5 text-xs text-gray-400">{i + 1}</td>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-1.5 text-sm text-gray-700 font-mono">
                            {cell === null ? <span className="text-gray-300 italic">NULL</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {activeTab === 'history' && (
            <div className="divide-y divide-gray-100">
              {queryHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <ClockIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No queries executed yet</p>
                </div>
              ) : (
                queryHistory.map((h, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => { setQuery(h.sql); setActiveTab('results'); }}>
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-gray-700 font-mono truncate flex-1">{h.sql}</code>
                      <div className="flex items-center gap-2 ml-4">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full', h.status === 'SUCCEEDED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {h.status}
                        </span>
                        <span className="text-xs text-gray-400">{h.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
