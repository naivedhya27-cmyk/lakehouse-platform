import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  HomeIcon,
  ServerStackIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CommandLineIcon,
  BeakerIcon,
  BoltIcon,
  CircleStackIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Clusters', href: '/clusters', icon: ServerStackIcon },
  { name: 'Jobs', href: '/jobs', icon: CpuChipIcon },
  { name: 'Notebooks', href: '/notebooks', icon: DocumentTextIcon },
  { name: 'SQL Editor', href: '/sql', icon: CommandLineIcon },
  { name: 'ML Experiments', href: '/ml', icon: BeakerIcon },
  { name: 'Streaming', href: '/streaming', icon: BoltIcon },
  { name: 'Data Catalog', href: '/catalog', icon: CircleStackIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 bg-gray-900">
          <div className="flex items-center h-16 px-4">
            <span className="text-xl font-bold text-white">Lakehouse</span>
            <span className="ml-1 text-xs text-indigo-400 font-mono">Platform</span>
          </div>

          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">LakehousePlatform v1.0.0</p>
            <p className="text-xs text-gray-600">Open Source Databricks Alternative</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {navigation.find(n => n.href === location.pathname)?.name || 'LakehousePlatform'}
          </h2>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
