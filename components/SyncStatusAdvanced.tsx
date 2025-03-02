'use client';

import React, { useEffect, useState } from 'react';
import { syncService, SyncQueueItem } from '../services/syncService';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

// Simple icon components to replace @radix-ui/react-icons
const ExclamationTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const CheckCircledIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const MinusCircledIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="8" y1="12" x2="16" y2="12"></line>
  </svg>
);

const ReloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"></path>
    <path d="M1 20v-6h6"></path>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const CrossCircledIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

export const SyncStatusAdvanced = () => {
  const [state, setState] = useState({
    pendingCount: 0,
    inProgressCount: 0,
    failedCount: 0,
    lastSync: null as string | null,
    lastSuccess: null as string | null,
    isOnline: true,
    isSyncing: false,
    showDetails: false,
    apiStatus: 'unknown' as 'unknown' | 'success' | 'error',
    apiMessage: '',
    apiDetails: {} as any,
  });
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);
  const [isTestingApi, setIsTestingApi] = useState(false);

  useEffect(() => {
    // Initial state
    updateState();
    
    // Subscribe to changes
    const unsubscribe = syncService.subscribe(() => {
      updateState();
    });
    
    return () => unsubscribe();
  }, []);

  const updateState = () => {
    const syncState = syncService.getState();
    setState(prevState => ({
      ...syncState,
      showDetails: prevState.showDetails,
      apiStatus: prevState.apiStatus,
      apiMessage: prevState.apiMessage,
      apiDetails: prevState.apiDetails,
    }));
    
    // Update failed items if there are any
    if (syncState.failedCount > 0) {
      setFailedItems(syncService.getFailedItems());
    }
  };

  const handleSync = () => {
    syncService.sync();
  };

  const handleRetry = () => {
    syncService.retryFailedItems();
  };

  const handleClear = () => {
    syncService.clearFailedItems();
    setFailedItems([]);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const testApiConnection = async () => {
    setIsTestingApi(true);
    setState(prevState => ({
      ...prevState,
      apiStatus: 'unknown',
      apiMessage: 'Testing connection...',
      apiDetails: {},
    }));
    
    try {
      const response = await fetch('/sign-in');
      const data = await response.json();
      
      if (response.ok) {
        setState(prevState => ({
          ...prevState,
          apiStatus: 'success',
          apiMessage: data.message || 'API connection successful',
          apiDetails: data,
        }));
      } else {
        setState(prevState => ({
          ...prevState,
          apiStatus: 'error',
          apiMessage: data.error || 'API connection failed',
          apiDetails: data,
        }));
      }
    } catch (error) {
      setState(prevState => ({
        ...prevState,
        apiStatus: 'error',
        apiMessage: error instanceof Error ? error.message : 'Unknown error',
        apiDetails: { error },
      }));
    } finally {
      setIsTestingApi(false);
    }
  };

  const getStatusBadge = () => {
    if (state.isSyncing) {
      return (
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center">
          <ReloadIcon />
          <span className="ml-1">Syncing</span>
        </span>
      );
    }
    
    if (state.failedCount > 0) {
      return (
        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs flex items-center">
          <ExclamationTriangleIcon />
          <span className="ml-1">{state.failedCount} Failed</span>
        </span>
      );
    }
    
    if (state.pendingCount > 0) {
      return (
        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs flex items-center">
          <MinusCircledIcon />
          <span className="ml-1">{state.pendingCount} Pending</span>
        </span>
      );
    }
    
    return (
      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center">
        <CheckCircledIcon />
        <span className="ml-1">Synced</span>
      </span>
    );
  };

  return (
    <Dialog>
      <div className="border rounded-lg overflow-hidden mb-6">
        <div className="bg-white p-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Google Drive Sync</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <div className="text-xs text-gray-500">
                  Status: {state.isOnline ? 'Online' : 'Offline'}
                </div>
                <div className="text-xs text-gray-500">
                  Last Sync: {formatDate(state.lastSync)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setState(prevState => ({ ...prevState, showDetails: true }))}
                >
                  Details
                </Button>
              </DialogTrigger>
            </div>
          </div>
        </div>
      </div>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Google Drive Sync Status</DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Connection</div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status:</span>
                  <span className={`text-sm font-medium ${state.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {state.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Last Sync:</span>
                  <span className="text-sm">{formatDate(state.lastSync)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Last Success:</span>
                  <span className="text-sm">{formatDate(state.lastSuccess)}</span>
                </div>
              </div>
            </div>
            
            <div className="border rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Queue Status</div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Pending:</span>
                  <span className="text-sm font-medium">{state.pendingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">In Progress:</span>
                  <span className="text-sm font-medium">{state.inProgressCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Failed:</span>
                  <span className={`text-sm font-medium ${state.failedCount > 0 ? 'text-red-600' : ''}`}>
                    {state.failedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between mb-4">
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={testApiConnection}
                disabled={isTestingApi}
              >
                {isTestingApi ? (
                  <>
                    <ReloadIcon />
                    <span className="ml-2">Testing Connection</span>
                  </>
                ) : (
                  'Test API Connection'
                )}
              </Button>
            </div>
            
            <div className="space-x-2">
              {state.failedCount > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    Clear Failed
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    Retry Failed
                  </Button>
                </>
              )}
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSync}
                disabled={state.isSyncing || !state.isOnline || state.pendingCount === 0}
              >
                {state.isSyncing ? (
                  <>
                    <ReloadIcon />
                    <span className="ml-2">Syncing...</span>
                  </>
                ) : (
                  'Sync Now'
                )}
              </Button>
            </div>
          </div>
          
          {/* API Test Results */}
          {state.apiStatus !== 'unknown' && (
            <Alert variant={state.apiStatus === 'success' ? 'default' : 'destructive'} className="mb-4">
              <div className="flex items-center">
                {state.apiStatus === 'success' ? (
                  <CheckCircledIcon />
                ) : (
                  <CrossCircledIcon />
                )}
                <span className="ml-2">
                  <AlertTitle>{state.apiStatus === 'success' ? 'Connection Successful' : 'Connection Failed'}</AlertTitle>
                </span>
              </div>
              <AlertDescription>
                {state.apiMessage}
                {state.apiStatus === 'error' && state.apiDetails.details && (
                  <div className="mt-2 text-xs whitespace-pre-wrap overflow-auto max-h-20">
                    {JSON.stringify(state.apiDetails.details, null, 2)}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Failed Items */}
          {failedItems.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Failed Uploads</h4>
              <div className="border rounded overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recording</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {failedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          {item.metadata.title}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-red-600 max-w-xs truncate">
                          {item.error}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          {item.attemptCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Troubleshooting Tips:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Make sure you have a stable internet connection</li>
              <li>Check if Google Drive API is properly configured in the server</li>
              <li>Verify the server has proper permissions to access Google Drive</li>
              <li>For file upload issues, ensure video files are not corrupted</li>
              <li>If problems persist, try clearing failed items and retrying</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SyncStatusAdvanced; 