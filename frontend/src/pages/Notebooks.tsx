import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  FolderIcon,
  DocumentTextIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

const languageIcons: Record<string, { color: string; label: string }> = {
  PYTHON: { color: 'text-yellow-600 bg-yellow-50', label: 'Py' },
  SCALA: { color: 'text-red-600 bg-red-50', label: 'Sc' },
  SQL: { color: 'text-blue-600 bg-blue-50', label: 'SQL' },
  R: { color: 'text-green-600 bg-green-50', label: 'R' },
};

interface WorkspaceObject {
  path: string;
  object_type: 'NOTEBOOK' | 'DIRECTORY' | 'FILE';
  language?: string;
}

export default function Notebooks() {
  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotebook, setNewNotebook] = useState({ name: '', language: 'PYTHON' });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  const { data: objects, isLoading } = useQuery({
    queryKey: ['workspace', currentPath],
    queryFn: () => api.get('/api/2.0/workspace/list', { params: { path: currentPath } }).then(r => r.data.objects),
  });

  const createNotebookMutation = useMutation({
    mutationFn: (notebook: { path: string; language: string }) =>
      api.post('/api/2.0/workspace/import', { ...notebook, content: '', format: 'SOURCE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setShowCreateModal(false);
      toast.success('Notebook created');
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (path: string) => api.post('/api/2.0/workspace/mkdirs', { path }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Folder created');
    },
  });

  const pathSegments = currentPath.split('/').filter(Boolean);

  const handleCreate = () => {
    const path = currentPath === '/' ? `/${newNotebook.name}` : `${currentPath}/${newNotebook.name}`;
    createNotebookMutation.mutate({ path, language: newNotebook.language });
  };

  const handleNavigate = (obj: WorkspaceObject) => {
    if (obj.object_type === 'DIRECTORY') {
      setCurrentPath(obj.path);
    } else {
      // Open notebook in embedded editor
      toast(`Opening notebook: ${obj.path}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">Interactive notebooks with Python, Scala, SQL, and R</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => createFolderMutation.mutate(currentPath + '/New Folder')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <FolderPlusIcon className="h-4 w-4" /> New Folder
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            <PlusIcon className="h-4 w-4" /> New Notebook
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search notebooks and files..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tree */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Explorer</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => setCurrentPath('/')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <FolderIcon className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">Workspace</span>
              </button>
              {['/Users', '/Shared', '/Repos'].map(folder => (
                <button
                  key={folder}
                  onClick={() => setCurrentPath(folder)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg pl-6"
                >
                  <FolderIcon className="h-4 w-4 text-yellow-400" />
                  {folder.split('/').pop()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm mb-4">
            <button onClick={() => setCurrentPath('/')} className="text-indigo-600 hover:text-indigo-800 font-medium">
              Workspace
            </button>
            {pathSegments.map((seg, i) => (
              <React.Fragment key={i}>
                <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                <button
                  onClick={() => setCurrentPath('/' + pathSegments.slice(0, i + 1).join('/'))}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {seg}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* File List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400">Loading workspace...</div>
            ) : !objects?.length ? (
              <div className="p-12 text-center">
                <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto" />
                <p className="mt-2 text-gray-500">This folder is empty</p>
                <button onClick={() => setShowCreateModal(true)}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 font-medium">
                  Create a notebook
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {objects.map((obj: WorkspaceObject) => (
                  <button
                    key={obj.path}
                    onClick={() => handleNavigate(obj)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    {obj.object_type === 'DIRECTORY' ? (
                      <FolderIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <div className={`flex items-center justify-center h-6 w-6 rounded text-xs font-bold flex-shrink-0 ${languageIcons[obj.language || 'PYTHON']?.color || 'text-gray-500 bg-gray-100'}`}>
                        {languageIcons[obj.language || 'PYTHON']?.label || '?'}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{obj.path.split('/').pop()}</span>
                    {obj.object_type === 'DIRECTORY' && (
                      <ChevronRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Notebook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Notebook</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={newNotebook.name}
                  onChange={e => setNewNotebook(p => ({ ...p, name: e.target.value }))}
                  placeholder="My Notebook"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(languageIcons).map(([lang, info]) => (
                    <button key={lang} onClick={() => setNewNotebook(p => ({ ...p, language: lang }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${newNotebook.language === lang ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreate} disabled={!newNotebook.name}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
