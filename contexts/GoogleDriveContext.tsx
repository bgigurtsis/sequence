'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import googleDriveService from '@/lib/googleDriveService';
import { useAuth } from '@clerk/nextjs';
import { hasGoogleConnection, getGoogleTokens } from '@/lib/clerkHelpers';
import { Recording, Performance, Rehearsal } from '@/types';

// Create a new QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface GoogleDriveContextType {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;

  // Data queries
  performances: Performance[];
  isLoadingPerformances: boolean;

  rehearsals: Rehearsal[];
  isLoadingRehearsals: boolean;

  recordings: Recording[];
  isLoadingRecordings: boolean;

  // Current selections
  selectedPerformanceId: string | null;
  selectedRehearsalId: string | null;

  // Selection actions
  selectPerformance: (id: string | null) => void;
  selectRehearsal: (id: string | null) => void;

  // Mutations
  createPerformance: (name: string) => Promise<Performance>;
  createRehearsal: (name: string) => Promise<Rehearsal>;
  uploadRecording: (rehearsalId: string, file: Blob, metadata: Record<string, any>) => Promise<any>;
  getRecordingUrl: (fileId: string) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;

  refresh: () => void;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export const GoogleDriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driveService, setDriveService] = useState<typeof googleDriveService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const { isLoaded, userId, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string | null>(null);

  // Initialize Google Drive service
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const initializeDriveService = async () => {
      try {
        const hasConnection = await hasGoogleConnection();

        if (!hasConnection) {
          setNeedsGoogleAuth(true);
          return;
        }

        const token = await getToken({ template: 'google_oauth' });

        if (!token) {
          setNeedsGoogleAuth(true);
          return;
        }

        const service = Object.create(googleDriveService);
        service.token = token;
        await service.initialize();

        setDriveService(service);
        setIsInitialized(true);
        setNeedsGoogleAuth(false);
      } catch (error) {
        console.error('Failed to initialize Google Drive service:', error);
        setNeedsGoogleAuth(true);
      }
    };

    initializeDriveService();
  }, [isLoaded, userId, getToken]);

  // Query to get performances
  const {
    data: performances = [],
    isLoading: isLoadingPerformances,
    refetch: refetchPerformances
  } = useQuery({
    queryKey: ['performances'],
    queryFn: async () => {
      if (!driveService) return [];
      return driveService.getPerformances();
    },
    enabled: isInitialized && !!driveService,
  });

  // Query for rehearsals in selected performance
  const {
    data: rehearsals = [],
    isLoading: isLoadingRehearsals,
    refetch: refetchRehearsals
  } = useQuery({
    queryKey: ['rehearsals', selectedPerformanceId],
    queryFn: async () => {
      if (!driveService || !selectedPerformanceId) return [];
      return driveService.getRehearsals(selectedPerformanceId);
    },
    enabled: isInitialized && !!selectedPerformanceId,
  });

  // Query for recordings in selected rehearsal
  const {
    data: recordings = [],
    isLoading: isLoadingRecordings,
    refetch: refetchRecordings
  } = useQuery({
    queryKey: ['recordings', selectedRehearsalId],
    queryFn: async () => {
      if (!driveService || !selectedRehearsalId) return [];
      return driveService.getRecordings(selectedRehearsalId);
    },
    enabled: isInitialized && !!selectedRehearsalId,
  });

  // Mutation to create a performance
  const createPerformanceMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!driveService) throw new Error('Google Drive service not initialized');
      return driveService.createPerformance(name);
    },
    onSuccess: (newPerformance) => {
      queryClient.setQueryData(['performances'],
        (old: Performance[] = []) => [...old, newPerformance]
      );
    },
  });

  // Mutation to create a rehearsal
  const createRehearsalMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!driveService || !selectedPerformanceId) {
        throw new Error('Performance not selected');
      }
      return driveService.createRehearsal(selectedPerformanceId, name);
    },
    onSuccess: (newRehearsal) => {
      queryClient.setQueryData(['rehearsals', selectedPerformanceId],
        (old: Rehearsal[] = []) => [...old, newRehearsal]
      );
    },
  });

  // Function to upload a recording
  const uploadRecording = async (rehearsalId: string, file: Blob, metadata: Record<string, any>) => {
    if (!driveService) throw new Error('Google Drive service not initialized');

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

    const result = await response.json();

    // Invalidate the recordings query to trigger a refetch
    queryClient.invalidateQueries({ queryKey: ['recordings', rehearsalId] });

    return result;
  };

  // Function to get recording URL
  const getRecordingUrl = async (fileId: string) => {
    if (!driveService) throw new Error('Google Drive service not initialized');
    return driveService.getRecordingUrl(fileId);
  };

  // Mutation to delete a file
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      if (!driveService) throw new Error('Google Drive service not initialized');

      await driveService.deleteFile(fileId);
    },
    onSuccess: (_, fileId) => {
      // If it's a recording, update the recordings list
      if (selectedRehearsalId) {
        queryClient.setQueryData(['recordings', selectedRehearsalId],
          (old: Recording[] = []) => old.filter(recording => recording.id !== fileId)
        );
      }
    },
  });

  // Function to refresh all data
  const refresh = () => {
    refetchPerformances();
    if (selectedPerformanceId) refetchRehearsals();
    if (selectedRehearsalId) refetchRecordings();
  };

  // Compute isLoading state
  const isLoading = isLoadingPerformances ||
    (!!selectedPerformanceId && isLoadingRehearsals) ||
    (!!selectedRehearsalId && isLoadingRecordings);

  const contextValue: GoogleDriveContextType = {
    isInitialized,
    isLoading,
    error: null,

    // Data
    performances,
    isLoadingPerformances,

    rehearsals,
    isLoadingRehearsals,

    recordings,
    isLoadingRecordings,

    // Current selections
    selectedPerformanceId,
    selectedRehearsalId,

    // Selection actions
    selectPerformance: setSelectedPerformanceId,
    selectRehearsal: setSelectedRehearsalId,

    // Mutations
    createPerformance: createPerformanceMutation.mutateAsync,
    createRehearsal: createRehearsalMutation.mutateAsync,
    uploadRecording,
    getRecordingUrl,
    deleteFile: deleteFileMutation.mutateAsync,

    refresh,
  };

  return (
    <GoogleDriveContext.Provider value={contextValue}>
      {children}
    </GoogleDriveContext.Provider>
  );
};

// Create a wrapper component that provides the QueryClient
export const GoogleDriveProviderWithQueryClient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleDriveProvider>
        {children}
      </GoogleDriveProvider>
    </QueryClientProvider>
  );
};

// Custom hook to use the Google Drive context
export const useGoogleDrive = () => {
  const context = useContext(GoogleDriveContext);

  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }

  return context;
}; 