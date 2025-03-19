'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleDriveService } from '@/lib/googleDriveService';
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

type GoogleDriveContextType = {
  isInitialized: boolean;
  needsGoogleAuth: boolean;
  connectToGoogle: () => Promise<void>;
  performances: Performance[];
  rehearsals: Record<string, Rehearsal[]>;
  recordings: Record<string, Recording[]>;
  createPerformance: (name: string) => Promise<Performance>;
  createRehearsal: (performanceId: string, name: string, location: string, date: string) => Promise<Rehearsal>;
  uploadRecording: (rehearsalId: string, file: Blob, metadata: any) => Promise<Recording>;
  deleteRecording: (recordingId: string, rehearsalId: string) => Promise<void>;
  getRecordingUrl: (recordingId: string) => Promise<string>;
  isLoading: boolean;
  error: Error | null;
};

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export const GoogleDriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driveService, setDriveService] = useState<GoogleDriveService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();

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

        const tokens = await getGoogleTokens();
        
        if (!tokens?.access_token) {
          setNeedsGoogleAuth(true);
          return;
        }

        const service = new GoogleDriveService(tokens.access_token, tokens.refresh_token);
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
  }, [isLoaded, userId]);

  // Function to connect to Google
  const connectToGoogle = async () => {
    try {
      const response = await fetch('/api/auth/google/authorize');
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting to Google:', error);
      throw error;
    }
  };

  // Query to get performances
  const { 
    data: performances = [], 
    isLoading: isLoadingPerformances,
    error: performancesError
  } = useQuery({
    queryKey: ['performances'],
    queryFn: async () => {
      if (!driveService) return [];
      
      const performanceFolders = await driveService.getPerformances();
      
      return performanceFolders.map(folder => ({
        id: folder.id,
        title: folder.name,
        defaultPerformers: [],
        rehearsals: [],
      }));
    },
    enabled: isInitialized && !!driveService,
  });

  // Mutation to create a performance
  const createPerformanceMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!driveService) throw new Error('Google Drive service not initialized');
      
      const folder = await driveService.createPerformance(name);
      
      return {
        id: folder.id,
        title: folder.name,
        defaultPerformers: [],
        rehearsals: [],
      };
    },
    onSuccess: (newPerformance: Performance) => {
      queryClient.setQueryData(['performances'], (old: Performance[] = []) => 
        [...old, newPerformance]
      );
    },
  });

  // Simplified rehearsals state (in a real app, you'd use React Query for each performance's rehearsals)
  const [rehearsals, setRehearsals] = useState<Record<string, Rehearsal[]>>({});

  // Mutation to create a rehearsal
  const createRehearsalMutation = useMutation({
    mutationFn: async ({ 
      performanceId, 
      name, 
      location, 
      date 
    }: { 
      performanceId: string; 
      name: string; 
      location: string; 
      date: string; 
    }) => {
      if (!driveService) throw new Error('Google Drive service not initialized');
      
      const folder = await driveService.createRehearsal(performanceId, name);
      
      return {
        id: folder.id,
        title: folder.name,
        location,
        date,
        recordings: [],
        performanceId,
        performanceTitle: performances.find((p: Performance) => p.id === performanceId)?.title,
      };
    },
    onSuccess: (newRehearsal: Rehearsal) => {
      setRehearsals(prev => ({
        ...prev,
        [newRehearsal.performanceId!]: [
          ...(prev[newRehearsal.performanceId!] || []),
          newRehearsal,
        ],
      }));
    },
  });

  // Simplified recordings state
  const [recordings, setRecordings] = useState<Record<string, Recording[]>>({});

  // Mutation to upload a recording
  const uploadRecordingMutation = useMutation({
    mutationFn: async ({ 
      rehearsalId, 
      file, 
      metadata 
    }: { 
      rehearsalId: string; 
      file: Blob; 
      metadata: any; 
    }) => {
      if (!driveService) throw new Error('Google Drive service not initialized');
      
      const filename = `${metadata.title || 'recording'}_${Date.now()}.mp4`;
      
      const uploadedFile = await driveService.uploadRecording(
        rehearsalId,
        file,
        filename,
        metadata
      );
      
      const videoUrl = await driveService.getRecordingUrl(uploadedFile.id);
      
      return {
        id: uploadedFile.id,
        title: metadata.title || uploadedFile.name,
        videoUrl,
        thumbnailUrl: '', // In a real app, you'd generate or fetch this
        time: metadata.time || new Date().toLocaleTimeString(),
        date: metadata.date || new Date().toLocaleDateString(),
        performers: metadata.performers || [],
        notes: metadata.notes || '',
        tags: metadata.tags || [],
        rehearsalId,
        sourceType: 'recorded',
        syncStatus: 'synced',
      };
    },
    onSuccess: (newRecording: Recording) => {
      setRecordings(prev => ({
        ...prev,
        [newRecording.rehearsalId]: [
          ...(prev[newRecording.rehearsalId] || []),
          newRecording,
        ],
      }));
    },
  });

  // Mutation to delete a recording
  const deleteRecordingMutation = useMutation({
    mutationFn: async ({ 
      recordingId, 
      rehearsalId 
    }: { 
      recordingId: string; 
      rehearsalId: string; 
    }) => {
      if (!driveService) throw new Error('Google Drive service not initialized');
      
      await driveService.deleteFile(recordingId);
      return { recordingId, rehearsalId };
    },
    onSuccess: ({ recordingId, rehearsalId }: { recordingId: string; rehearsalId: string }) => {
      setRecordings(prev => ({
        ...prev,
        [rehearsalId]: (prev[rehearsalId] || []).filter(r => r.id !== recordingId),
      }));
    },
  });

  // Function to get a recording URL
  const getRecordingUrl = async (recordingId: string): Promise<string> => {
    if (!driveService) throw new Error('Google Drive service not initialized');
    return driveService.getRecordingUrl(recordingId);
  };

  const contextValue: GoogleDriveContextType = {
    isInitialized,
    needsGoogleAuth,
    connectToGoogle,
    performances,
    rehearsals,
    recordings,
    createPerformance: (name: string) => createPerformanceMutation.mutateAsync(name),
    createRehearsal: (performanceId: string, name: string, location: string, date: string) => 
      createRehearsalMutation.mutateAsync({ performanceId, name, location, date }),
    uploadRecording: (rehearsalId: string, file: Blob, metadata: any) => 
      uploadRecordingMutation.mutateAsync({ rehearsalId, file, metadata }),
    deleteRecording: (recordingId: string, rehearsalId: string) => 
      deleteRecordingMutation.mutateAsync({ recordingId, rehearsalId }),
    getRecordingUrl,
    isLoading: isLoadingPerformances || createPerformanceMutation.isPending || 
               createRehearsalMutation.isPending || uploadRecordingMutation.isPending,
    error: performancesError as Error || null,
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