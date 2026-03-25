import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clusters from './pages/Clusters';
import Jobs from './pages/Jobs';
import Notebooks from './pages/Notebooks';
import SQLEditor from './pages/SQLEditor';
import MLExperiments from './pages/MLExperiments';
import Streaming from './pages/Streaming';
import DataCatalog from './pages/DataCatalog';
import Settings from './pages/Settings';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="clusters" element={<Clusters />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="notebooks" element={<Notebooks />} />
            <Route path="sql" element={<SQLEditor />} />
            <Route path="ml" element={<MLExperiments />} />
            <Route path="streaming" element={<Streaming />} />
            <Route path="catalog" element={<DataCatalog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
