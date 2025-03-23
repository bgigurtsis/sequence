'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { hasGoogleConnection } from '@/lib/clientHelpers';
import type { Recording, Performance, Rehearsal } from '@/types';
// Remove the problematic import and define the interface locally
// import type { GoogleDriveContextType } from '@/types';

// Define the interface locally to work around the import issue
interface GoogleDriveContextType {
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<void>;
  refreshStatus: () => void;
  performances: Performance[];
  rehearsals: any;
  recordings: any;
  createPerformance: (title: string) => Promise<any>;
  createRehearsal: (name: string, location?: string, date?: string) => Promise<any>;
  getRecordingUrl: (fileId: string) => Promise<string>;
  needsGoogleAuth: boolean;
  connectToGoogle: () => Promise<void>;
  isInitialized?: boolean;
  isLoadingPerformances?: boolean;
  errorPerformances?: Error | null;
  isLoadingRehearsals?: boolean;
  errorRehearsals?: Error | null;
  isLoadingRecordings?: boolean;
  errorRecordings?: Error | null;
  selectedPerformanceId?: string | null;
  selectedRehearsalId?: string | null;
  selectPerformance?: (id: string | null) => void;
  selectRehearsal?: (id: string | null) => void;
  uploadRecording?: (rehearsalId: string, file: Blob, metadata: any) => Promise<any>;
  deleteFile?: (fileId: string) => Promise<void>;
  isAuthenticating?: boolean;
  refreshData?: () => void;
  listFiles: () => Promise<any[]>;
  performDriveOperation: (operation: string, params: any) => Promise<any>;
}

// Create a default context value that matches the interface
const defaultContextValue: GoogleDriveContextType = {
  isLoading: false,
  error: null,
  isConnected: false,
  connectGoogleDrive: async () => { /* implementation */ },
  disconnectGoogleDrive: async () => { /* implementation */ },
  refreshStatus: () => { /* implementation */ },
  performances: [],
  rehearsals: {},
  recordings: {},
  createPerformance: async () => '',
  createRehearsal: async () => '',
  getRecordingUrl: async () => '',
  needsGoogleAuth: false,
  connectToGoogle: async () => { /* implementation */ },
  listFiles: async () => [],
  performDriveOperation: async () => { /* implementation */ },
};

// Create the context with the properly typed default value
const GoogleDriveContext = createContext<GoogleDriveContextType>(defaultContextValue);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize connection check
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const checkConnection = async () => {
      try {
        setIsAuthenticating(true);
        const hasConnection = await hasGoogleConnection();

        if (!hasConnection) {
          setNeedsGoogleAuth(true);
          return;
        }

        const response = await fetch('/api/drive/auth');
        const data = await response.json();

        if (data.authenticated) {
          setIsInitialized(true);
          setNeedsGoogleAuth(false);
        } else {
          setNeedsGoogleAuth(true);
        }
      } catch (error) {
        console.error('Failed to check Google Drive connection:', error);
        setNeedsGoogleAuth(true);
      } finally {
        setIsAuthenticating(false);
      }
    };

    checkConnection();
  }, [isLoaded, userId]);

  // Query to get performances
  const {
    data: performances = [],
    isLoading: isLoadingPerformances,
    error: errorPerformances,
    refetch: refetchPerformances
  } = useQuery({
    queryKey: ['performances'],
    queryFn: async () => {
      if (!isInitialized) return [];
      return [];
    },
    enabled: isInitialized,
  });

  // Query for rehearsals in selected performance
  const {
    data: rehearsals = [],
    isLoading: isLoadingRehearsals,
    error: errorRehearsals,
    refetch: refetchRehearsals
  } = useQuery({
    queryKey: ['rehearsals', selectedPerformanceId],
    queryFn: async () => {
      if (!isInitialized || !selectedPerformanceId) return [];
      return [];
    },
    enabled: isInitialized && !!selectedPerformanceId,
  });

  // Query for recordings in selected rehearsal
  const {
    data: recordings = [],
    isLoading: isLoadingRecordings,
    error: errorRecordings,
    refetch: refetchRecordings
  } = useQuery({
    queryKey: ['recordings', selectedRehearsalId],
    queryFn: async () => {
      if (!isInitialized || !selectedRehearsalId) return [];
      return [];
    },
    enabled: isInitialized && !!selectedRehearsalId,
  });

  // Mutation to create a performance
  const createPerformanceMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!isInitialized) throw new Error('Google Drive service not initialized');
      return '';
    },
    onSuccess: (newPerformance) => {
      queryClient.setQueryData(['performances'],
        (old: Performance[] = []) => [...old, { id: '', title: newPerformance } as Performance]
      );
    },
  });

  // Mutation to create a rehearsal
  const createRehearsalMutation = useMutation({
    mutationFn: async (params: { name: string, location?: string, date?: string }) => {
      if (!isInitialized || !selectedPerformanceId) {
        throw new Error('Performance not selected');
      }
      return '';
    },
    onSuccess: (newRehearsal) => {
      queryClient.setQueryData(['rehearsals', selectedPerformanceId],
        (old: Rehearsal[] = []) => [...old, {
          id: '',
          title: newRehearsal,
          location: '',
          date: new Date().toISOString(),
          recordings: [],
        } as Rehearsal]
      );
    },
  });

  // Upload a recording
  const uploadRecordingMutation = useMutation({
    mutationFn: async ({ rehearsalId, file, metadata }: { rehearsalId: string, file: Blob, metadata: any }) => {
      if (!isInitialized) throw new Error('Google Drive service not initialized');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('rehearsalId', rehearsalId);
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload recording');
      }

      return '';
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recordings', variables.rehearsalId] });
    },
  });

  // Get recording URL
  const getRecordingUrl = async (fileId: string) => {
    if (!isInitialized) throw new Error('Google Drive service not initialized');
    return '';
  };

  // Delete a file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      if (!isInitialized) throw new Error('Google Drive service not initialized');
    },
    onSuccess: (_, fileId) => {
      // If deleting a recording, refresh recordings
      if (selectedRehearsalId) {
        queryClient.setQueryData(['recordings', selectedRehearsalId],
          (old: Recording[] = []) => old.filter(recording => recording.id !== fileId)
        );
      }
      // If deleting a rehearsal, refresh rehearsals
      else if (selectedPerformanceId) {
        queryClient.setQueryData(['rehearsals', selectedPerformanceId],
          (old: Rehearsal[] = []) => old.filter(rehearsal => rehearsal.id !== fileId)
        );
      }
      // If deleting a performance, refresh performances
      else {
        queryClient.setQueryData(['performances'],
          (old: Performance[] = []) => old.filter(performance => performance.id !== fileId)
        );
      }
    },
  });

  // Connect to Google (initiate OAuth flow)
  const connectToGoogle = async () => {
    try {
      // Redirect to Google OAuth flow
      window.location.href = '/api/auth/google/authorize';
    } catch (error) {
      console.error('Failed to connect to Google:', error);
    }
  };

  // Refresh all data
  const refreshData = () => {
    refetchPerformances();
    if (selectedPerformanceId) refetchRehearsals();
    if (selectedRehearsalId) refetchRecordings();
  };

  // Compute isLoading state
  const isLoadingState = isLoadingPerformances ||
    (!!selectedPerformanceId && isLoadingRehearsals) ||
    (!!selectedRehearsalId && isLoadingRecordings);

  const listFiles = async () => {
    try {
      const res = await fetch('/api/drive/list-files');
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      return data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  };

  const performDriveOperation = async (operation: string, params: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/drive/operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation, params }),
      });
      return await response.json();
    } catch (error) {
      console.error('Drive operation failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: GoogleDriveContextType = {
    isInitialized,
    isLoading: isLoadingState,
    error: null,
    isConnected: isInitialized,
    connectGoogleDrive: connectToGoogle,
    disconnectGoogleDrive: async () => {
      try {
        const response = await fetch('/api/auth/google-disconnect', {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to disconnect from Google Drive');
        setIsInitialized(false);
        queryClient.clear();
      } catch (error) {
        console.error('Error disconnecting from Google Drive:', error);
        throw error;
      }
    },
    refreshStatus: refreshData,
    performances,
    isLoadingPerformances,
    errorPerformances,
    rehearsals,
    isLoadingRehearsals,
    errorRehearsals,
    recordings,
    isLoadingRecordings,
    errorRecordings,
    selectedPerformanceId,
    selectedRehearsalId,
    selectPerformance: setSelectedPerformanceId,
    selectRehearsal: setSelectedRehearsalId,
    createPerformance: createPerformanceMutation.mutateAsync,
    createRehearsal: (name: string, location?: string, date?: string) =>
      createRehearsalMutation.mutateAsync({ name, location, date }),
    uploadRecording: (rehearsalId: string, file: Blob, metadata: any) =>
      uploadRecordingMutation.mutateAsync({ rehearsalId, file, metadata }),
    getRecordingUrl,
    deleteFile: deleteFileMutation.mutateAsync,
    isAuthenticating,
    needsGoogleAuth,
    connectToGoogle,
    refreshData,
    listFiles,
    performDriveOperation,
  };

  useEffect(() => {
    console.log('GoogleDriveContext state:', {
      isInitialized,
      isLoading,
      needsGoogleAuth,
      performances: performances?.length
    });
  }, [isInitialized, isLoading, needsGoogleAuth, performances]);

  return (
    <GoogleDriveContext.Provider value={value}>
      {children}
    </GoogleDriveContext.Provider>
  );
}

// Custom hook to use the Google Drive context
export function useGoogleDrive(): GoogleDriveContextType {
  const context = useContext(GoogleDriveContext);
  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  return context;
} 