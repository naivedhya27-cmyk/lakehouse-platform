import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  PlusIcon,
  CircleStackIcon,
  FolderIcon,
  TableCellsIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

interface CatalogItem {
  name: string;
  comment?: string;
  owner?: string;
}

interface TableItem {
  name: string;
  catalog_name: string;
  schema_name: string;
  table_type: string;
  data_source_format: string;
  columns?: { name: string; type_name: string; nullable: boolean }[];
}

export default function DataCatalog() {
  const queryClient = useQueryClient();
  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'catalog' | 'schema' | 'table'>('catalog');
  const [newName, setNewName] = useState('');

  const { data: catalogs } = useQuery({
    queryKey: ['catalogs'],
    queryFn: () => api.get('/api/2.0/unity-catalog/catalogs').then(r => r.data.catalogs),
  });

  const { data: schemas } = useQuery({
    queryKey: ['schemas', selectedCatalog],
    queryFn: () => api.get('/api/2.0/unity-catalog/schemas', { params: { catalog_name: selectedCatalog } }).then(r => r.data.schemas),
    enabled: !!selectedCatalog,
  });

  const { data: tables } = useQuery({
    queryKey: ['tables', selectedCatalog, selectedSchema],
    queryFn: () => api.get('/api/2.0/unity-catalog/tables', {
      params: { catalog_name: selectedCatalog, schema_name: selectedSchema }
    }).then(r => r.data.tables),
    enabled: !!selectedCatalog && !!selectedSchema,
  });

  const createCatalogMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/2.0/unity-catalog/catalogs', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      setShowCreateModal(false);
      toast.success('Catalog created');
    },
  });

  const createSchemaMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/2.0/unity-catalog/schemas', { name, catalog_name: selectedCatalog }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemas'] });
      setShowCreateModal(false);
      toast.success('Schema created');
    },
  });

  const breadcrumbs = [
    { label: 'Catalogs', onClick: () => { setSelectedCatalog(null); setSelectedSchema(null); setSelectedTable(null); } },
    ...(selectedCatalog ? [{ label: selectedCatalog, onClick: () => { setSelectedSchema(null); setSelectedTable(null); } }] : []),
    ...(selectedSchema ? [{ label: selectedSchema, onClick: () => { setSelectedTable(null); } }] : []),
    ...(selectedTable ? [{ label: selectedTable, onClick: () => {} }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">Unity Catalog compatible — browse catalogs, schemas, and tables</p>
        </div>
        <button onClick={() => {
          setCreateType(!selectedCatalog ? 'catalog' : !selectedSchema ? 'schema' : 'table');
          setShowCreateModal(true);
        }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm">
          <PlusIcon className="h-4 w-4" />
          {!selectedCatalog ? 'New Catalog' : !selectedSchema ? 'New Schema' : 'New Table'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search tables, schemas, and catalogs..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((bc, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRightIcon className="h-3 w-3 text-gray-400" />}
            <button onClick={bc.onClick}
              className={clsx('font-medium', i === breadcrumbs.length - 1 ? 'text-gray-900' : 'text-indigo-600 hover:text-indigo-800')}>
              {bc.label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Catalogs Level */}
        {!selectedCatalog && (
          <div className="divide-y divide-gray-100">
            {!catalogs?.length ? (
              <div className="p-12 text-center">
                <CircleStackIcon className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="mt-2 text-gray-500">No catalogs yet. Create one to get started.</p>
              </div>
            ) : (
              catalogs.map((cat: CatalogItem) => (
                <button key={cat.name} onClick={() => setSelectedCatalog(cat.name)}
                  className="flex items-center gap-4 w-full px-6 py-4 hover:bg-gray-50 text-left">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <CircleStackIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    <p className="text-xs text-gray-500">{cat.comment || 'No description'}</p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Schemas Level */}
        {selectedCatalog && !selectedSchema && (
          <div className="divide-y divide-gray-100">
            {!schemas?.length ? (
              <div className="p-12 text-center">
                <FolderIcon className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="mt-2 text-gray-500">No schemas in this catalog</p>
              </div>
            ) : (
              schemas.map((s: CatalogItem) => (
                <button key={s.name} onClick={() => setSelectedSchema(s.name)}
                  className="flex items-center gap-4 w-full px-6 py-4 hover:bg-gray-50 text-left">
                  <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                    <FolderIcon className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{selectedCatalog}.{s.name}</p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Tables Level */}
        {selectedCatalog && selectedSchema && !selectedTable && (
          <div className="divide-y divide-gray-100">
            {!tables?.length ? (
              <div className="p-12 text-center">
                <TableCellsIcon className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="mt-2 text-gray-500">No tables in this schema</p>
              </div>
            ) : (
              tables.map((t: TableItem) => (
                <button key={t.name} onClick={() => setSelectedTable(t.name)}
                  className="flex items-center gap-4 w-full px-6 py-4 hover:bg-gray-50 text-left">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <TableCellsIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.data_source_format || 'DELTA'} · {t.table_type || 'MANAGED'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      {t.data_source_format || 'DELTA'}
                    </span>
                    <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Table Detail */}
        {selectedTable && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                <TableCellsIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedTable}</h3>
                <p className="text-sm text-gray-500">{selectedCatalog}.{selectedSchema}.{selectedTable}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Schema</h4>
              <p className="text-sm text-gray-500">Loading table schema...</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create {createType}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder={`my_${createType}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button disabled={!newName}
                onClick={() => {
                  if (createType === 'catalog') createCatalogMutation.mutate(newName);
                  else if (createType === 'schema') createSchemaMutation.mutate(newName);
                  setNewName('');
                }}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
