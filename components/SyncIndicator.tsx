'use client';

import React, { useEffect, useState } from 'react';
import { syncService } from '@/services/syncService';

export function SyncIndicator() {
    const [syncState, setSyncState] = useState({
        pendingCount: 0,
        isSyncing: false,
        isOnline: true
    });

    useEffect(() => {
        // Initialize with current state
        const currentState = syncService.getState();
        setSyncState({
            pendingCount: currentState.pendingCount,
            isSyncing: currentState.isSyncing,
            isOnline: currentState.isOnline
        });

        // Subscribe to sync service updates
        const unsubscribe = syncService.subscribe(() => {
            const updatedState = syncService.getState();
            setSyncState({
                pendingCount: updatedState.pendingCount,
                isSyncing: updatedState.isSyncing,
                isOnline: updatedState.isOnline
            });
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Don't show anything if nothing is pending and not currently syncing
    if (syncState.pendingCount === 0 && !syncState.isSyncing) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-white dark:bg-gray-800 text-sm rounded-lg shadow-lg p-3 flex items-center space-x-2">
                {syncState.isSyncing ? (
                    <>
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <span>Syncing...</span>
                    </>
                ) : syncState.pendingCount > 0 ? (
                    <>
                        <div className={`h-3 w-3 rounded-full ${syncState.isOnline ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                        <span>
                            {syncState.isOnline
                                ? `${syncState.pendingCount} item${syncState.pendingCount !== 1 ? 's' : ''} pending`
                                : 'Waiting for connection'}
                        </span>
                    </>
                ) : null}
            </div>
        </div>
    );
} 