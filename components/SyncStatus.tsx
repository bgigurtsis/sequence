'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, AlertCircle, Check, Clock } from 'lucide-react';
import { syncService } from '../services/syncService';

const SyncStatus: React.FC = () => {
  const [stats, setStats] = useState(syncService.getStats());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setStats);
    return unsubscribe;
  }, []);

  const handleSync = () => {
    syncService.sync();
  };

  const getStatusIcon = () => {
    if (!stats.isOnline) {
      return <CloudOff size={18} className="text-red-500" />;
    } else if (stats.failed > 0) {
      return <AlertCircle size={18} className="text-amber-500" />;
    } else if (stats.pending > 0 || stats.inProgress > 0) {
      return <Clock size={18} className="text-blue-500" />;
    } else {
      return <Check size={18} className="text-green-500" />;
    }
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center space-x-1 p-1 rounded hover:bg-gray-100"
        title="Sync status"
      >
        {getStatusIcon()}
        <span className="text-xs font-medium">
          {stats.pending + stats.inProgress > 0 ? `${stats.pending + stats.inProgress} pending` : 'Synced'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border p-3 z-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Sync Status</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">×</button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Connection:</span>
              <span className={stats.isOnline ? 'text-green-500' : 'text-red-500'}>
                {stats.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Pending:</span>
              <span>{stats.pending}</span>
            </div>
            
            <div className="flex justify-between">
              <span>In Progress:</span>
              <span>{stats.inProgress}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Failed:</span>
              <span className={stats.failed > 0 ? 'text-red-500' : ''}>
                {stats.failed}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Last Attempt:</span>
              <span>{formatTime(stats.lastSyncAttempt)}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Last Success:</span>
              <span>{formatTime(stats.lastSuccessfulSync)}</span>
            </div>
          </div>
          
          <button
            onClick={handleSync}
            disabled={!stats.isOnline || stats.inProgress > 0}
            className="mt-3 w-full px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
          >
            Sync Now
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncStatus; 