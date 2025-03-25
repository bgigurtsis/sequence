// contexts/PerformanceContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Performance, Rehearsal, Recording, Metadata, Collection } from '../types';
import { videoStorage } from '../services/videoStorage';
import { syncService } from '../services/syncService';
import { generateId } from '../lib/utils';
import { validateAllTokensWithRetry, logWithTimestamp } from '@/lib/sessionUtils';

interface PerformanceContextType {
  // State
  performances: Performance[];
  selectedPerformanceId: string;
  searchQuery: string;
  showRecorder: boolean;
  showMetadataForm: boolean;
  showPerformanceForm: boolean;
  showRehearsalForm: boolean;
  showPreRecordingMetadataForm: boolean;
  editingRecording: { rehearsalId: string; recording: Recording } | null;
  editingRehearsal: { performanceId: string; rehearsal: Rehearsal } | null;
  editingPerformance: Performance | null;
  recordingTargetRehearsalId: string | null;
  preRecordingMetadata: Metadata | null;
  videoToWatch: { recording: Recording; videoUrl: string } | null;

  // Add these missing state setters
  setShowRecorder: (show: boolean) => void;
  setPreRecordingMetadata: (metadata: Metadata | null) => void;
  setRecordingTargetRehearsalId: (id: string | null) => void;

  // Computed Properties
  selectedPerformance: Performance | undefined;
  filteredRecordings: Recording[];
  todaysRecordings: Recording[];

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedPerformanceId: (id: string) => void;

  // Modal Controls
  openRecorder: () => void;
  closeRecorder: () => void;
  openPreRecordingMetadata: (rehearsalId: string) => void;
  closePreRecordingMetadata: () => void;
  openMetadataForm: (rehearsalId: string, recording: Recording) => void;
  closeMetadataForm: () => void;
  openPerformanceForm: (performance?: Performance) => void;
  closePerformanceForm: () => void;
  openRehearsalForm: (performanceId: string, rehearsal?: Rehearsal) => void;
  closeRehearsalForm: () => void;
  openVideoPlayer: (recording: Recording) => void;
  closeVideoPlayer: () => void;

  // CRUD Operations
  addPerformance: (data: { title: string; defaultPerformers: string[] }) => void;
  updatePerformance: (data: { title: string; defaultPerformers: string[] }) => void;
  deletePerformance: (performanceId: string) => Promise<void>;
  addRehearsal: (data: { title: string; location: string; date: string }) => void;
  updateRehearsal: (data: { title: string; location: string; date: string }) => void;
  deleteRehearsal: () => Promise<void>;
  addRecording: (rehearsalId: string, videoBlob: Blob, thumbnail: Blob | string, metadata?: Partial<Metadata>) => Promise<string>;
  updateRecordingMetadata: (metadata: Metadata) => void;
  deleteRecording: () => Promise<void>;
  handlePreRecordingMetadataSubmit: (metadata: Metadata) => void;
  collections: Collection[];
  createCollection: (data: { title: string; description?: string }) => void;
  updateCollection: (id: string, data: { title: string; description?: string }) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string, recordingId: string) => void;
  removeFromCollection: (collectionId: string, recordingId: string) => void;

  // State setters
  setPerformances: React.Dispatch<React.SetStateAction<Performance[]>>;

  // New properties
  handleExternalVideoLink: (metadata: Metadata & { externalUrl: string }) => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const PerformanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State variables from original page.tsx
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string>('');
  const [recordingTargetRehearsalId, setRecordingTargetRehearsalId] = useState<string | null>(null);
  const [showPreRecordingMetadataForm, setShowPreRecordingMetadataForm] = useState<boolean>(false);
  const [preRecordingMetadata, setPreRecordingMetadata] = useState<Metadata | null>(null);
  const [showRecorder, setShowRecorder] = useState<boolean>(false);
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);
  const [editingRecording, setEditingRecording] = useState<{ rehearsalId: string; recording: Recording } | null>(null);
  const [videoToWatch, setVideoToWatch] = useState<{ recording: Recording; videoUrl: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPerformanceForm, setShowPerformanceForm] = useState<boolean>(false);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);
  const [showRehearsalForm, setShowRehearsalForm] = useState<boolean>(false);
  const [editingRehearsal, setEditingRehearsal] = useState<{ performanceId: string; rehearsal: Rehearsal } | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Initialize performances from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('performances');
    if (saved) {
      const parsed = JSON.parse(saved) as Performance[];
      setPerformances(parsed);
      if (parsed.length > 0) {
        setSelectedPerformanceId(parsed[0].id);
      }
    }
  }, []);

  // Save performances to localStorage when they change
  useEffect(() => {
    localStorage.setItem('performances', JSON.stringify(performances));
  }, [performances]);

  // Load collections from localStorage
  useEffect(() => {
    const savedCollections = localStorage.getItem('collections');
    if (savedCollections) {
      try {
        setCollections(JSON.parse(savedCollections));
      } catch (e) {
        console.error('Failed to parse collections from localStorage', e);
      }
    }
  }, []);

  // Save collections to localStorage when they change
  useEffect(() => {
    localStorage.setItem('collections', JSON.stringify(collections));
  }, [collections]);

  // Helper function to update performances state
  const updatePerformances = (newPerformances: Performance[]) => {
    setPerformances(newPerformances);
    localStorage.setItem('performances', JSON.stringify(newPerformances));
  };

  // Computed properties
  const selectedPerformance = performances.find((p) => p.id === selectedPerformanceId);

  // Get today's recordings
  const todaysRecordings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const result: Recording[] = [];

    performances.forEach(performance => {
      performance.rehearsals.forEach(rehearsal => {
        if (rehearsal.date === today) {
          rehearsal.recordings.forEach(recording => {
            result.push({
              ...recording,
            });
          });
        }
      });
    });

    return result;
  }, [performances]);

  // Filter recordings based on search query
  const filteredRecordings = useMemo(() => {
    if (!searchQuery.trim() || !selectedPerformance) return [];

    const result: Recording[] = [];
    const query = searchQuery.toLowerCase();

    selectedPerformance.rehearsals.forEach(rehearsal => {
      rehearsal.recordings.forEach(recording => {
        if (
          recording.title.toLowerCase().includes(query) ||
          recording.performers.some(p => p.toLowerCase().includes(query)) ||
          (recording.tags && recording.tags.some(t => t.toLowerCase().includes(query))) ||
          (recording.notes && recording.notes.toLowerCase().includes(query))
        ) {
          result.push({
            ...recording,
          });
        }
      });
    });

    return result;
  }, [selectedPerformance, searchQuery]);

  // Modal control functions
  const openRecorder = () => setShowRecorder(true);
  const closeRecorder = () => {
    setShowRecorder(false);
    setRecordingTargetRehearsalId(null);
  };

  const openPreRecordingMetadata = (rehearsalId: string) => {
    setRecordingTargetRehearsalId(rehearsalId);
    setShowPreRecordingMetadataForm(true);
  };

  const closePreRecordingMetadata = () => {
    setShowPreRecordingMetadataForm(false);
    setRecordingTargetRehearsalId(null);
  };

  const openMetadataForm = (rehearsalId: string, recording: Recording) => {
    setEditingRecording({ rehearsalId, recording });
    setShowMetadataForm(true);
  };

  const closeMetadataForm = () => {
    setShowMetadataForm(false);
    setEditingRecording(null);
  };

  const openPerformanceForm = (performance?: Performance) => {
    if (performance) {
      setEditingPerformance(performance);
    } else {
      setEditingPerformance(null);
    }
    setShowPerformanceForm(true);
  };

  const closePerformanceForm = () => {
    setShowPerformanceForm(false);
    setEditingPerformance(null);
  };

  const openRehearsalForm = (performanceId: string, rehearsal?: Rehearsal) => {
    if (rehearsal) {
      setEditingRehearsal({ performanceId, rehearsal });
    } else {
      setEditingRehearsal(null);
    }
    setShowRehearsalForm(true);
  };

  const closeRehearsalForm = () => {
    setShowRehearsalForm(false);
    setEditingRehearsal(null);
  };

  const openVideoPlayer = (recording: Recording) => {
    setVideoToWatch({ recording, videoUrl: recording.videoUrl });
  };

  const closeVideoPlayer = () => {
    setVideoToWatch(null);
  };

  // Pre-recording metadata handler
  const handlePreRecordingMetadataSubmit = (metadata: Metadata) => {
    console.log('Pre-recording metadata submitted:', metadata);

    // Ensure rehearsalId is set
    if (!metadata.rehearsalId) {
      console.error('Missing rehearsalId in metadata');
      return;
    }

    // Find the rehearsal to validate it exists
    const performanceId = findPerformanceIdByRehearsalId(metadata.rehearsalId);
    const performance = performances.find(p => p.id === performanceId);

    if (!performance) {
      console.error('Performance not found for rehearsal', metadata.rehearsalId);
      return;
    }

    const rehearsal = performance.rehearsals.find(r => r.id === metadata.rehearsalId);
    if (!rehearsal) {
      console.error('Rehearsal not found', metadata.rehearsalId);
      return;
    }

    console.log(`Recording will be added to rehearsal "${rehearsal.title}" in performance "${performance.title}"`);

    // Set state for recording process
    setPreRecordingMetadata(metadata);
    setShowPreRecordingMetadataForm(false);
    setRecordingTargetRehearsalId(metadata.rehearsalId);
    setShowRecorder(true);
  };

  // CRUD operations
  const addPerformance = (data: { title: string; defaultPerformers: string[] }) => {
    console.log('Adding performance:', data);

    // Validate data
    if (!data.title) {
      console.error('Cannot add performance: Title is required');
      return;
    }

    const newPerformance = {
      id: 'perf-' + Date.now(),
      title: data.title,
      defaultPerformers: data.defaultPerformers || [],
      rehearsals: [],
    };

    console.log('New performance object:', newPerformance);

    const updated = [...performances, newPerformance];
    console.log('Updated performances array:', updated);

    updatePerformances(updated);
    setSelectedPerformanceId(newPerformance.id);
    setShowPerformanceForm(false);
  };

  const updatePerformance = (data: { title: string; defaultPerformers: string[] }) => {
    if (!editingPerformance) return;

    const updated = performances.map((perf) => {
      if (perf.id === editingPerformance.id) {
        return { ...perf, title: data.title, defaultPerformers: data.defaultPerformers };
      }
      return perf;
    });
    updatePerformances(updated);
    setEditingPerformance(null);
    setShowPerformanceForm(false);
  };

  const deletePerformance = async (performanceId: string) => {
    try {
      const performance = performances.find(p => p.id === performanceId);
      if (!performance) {
        console.error('Cannot delete performance: Not found', performanceId);
        throw new Error('Performance not found');
      }

      console.log('Deleting performance from local state:', performance.title);

      // Update local state first (offline-first approach)
      const updated = performances.filter((p) => p.id !== performanceId);
      updatePerformances(updated);
      setSelectedPerformanceId(updated.length > 0 ? updated[0].id : '');
      setEditingPerformance(null);
      setShowPerformanceForm(false);

      // Then try to delete from Google Drive
      try {
        console.log('Sending delete request to Google Drive API for performance:', performance.title);
        const res = await fetch('/api/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'performance',
            performanceId,
            performanceTitle: performance.title
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Failed to delete performance from Google Drive: ${res.status} ${res.statusText}`, errorText);
          // We don't throw here because we've already updated the local state
        } else {
          console.log('Successfully deleted performance from Google Drive:', performance.title);
        }
      } catch (driveError) {
        console.error('Error communicating with Google Drive API:', driveError);
        // Don't rethrow, as we've already updated local state
      }
    } catch (error) {
      console.error('Failed to delete performance:', error);
      throw error;
    }
  };

  const addRehearsal = (data: { title: string; location: string; date: string }) => {
    const newRehearsal = {
      id: 'reh-' + Date.now(),
      title: data.title,
      location: data.location,
      date: data.date,
      recordings: [],
    };
    const updated = performances.map((perf) => {
      if (perf.id === selectedPerformanceId) {
        return { ...perf, rehearsals: [...perf.rehearsals, newRehearsal] };
      }
      return perf;
    });
    updatePerformances(updated);
    setShowRehearsalForm(false);
  };

  const updateRehearsal = (data: { title: string; location: string; date: string }) => {
    if (!editingRehearsal) return;

    const updated = performances.map((perf) => {
      if (perf.id === editingRehearsal.performanceId) {
        const updatedRehearsals = perf.rehearsals.map((reh) => {
          if (reh.id === editingRehearsal.rehearsal.id) {
            return { ...reh, title: data.title, location: data.location, date: data.date };
          }
          return reh;
        });
        return { ...perf, rehearsals: updatedRehearsals };
      }
      return perf;
    });
    updatePerformances(updated);
    setEditingRehearsal(null);
    setShowRehearsalForm(false);
  };

  const deleteRehearsal = async () => {
    if (!editingRehearsal) return;

    try {
      const performance = performances.find(p => p.id === editingRehearsal.performanceId);

      if (!performance) {
        throw new Error('Performance not found');
      }

      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'rehearsal',
          performanceId: editingRehearsal.performanceId,
          performanceTitle: performance.title,
          rehearsalId: editingRehearsal.rehearsal.id,
          rehearsalTitle: editingRehearsal.rehearsal.title
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to delete from Google Drive: ${res.statusText}`);
      }

      // Update local state
      const updated = performances.map((perf) => {
        if (perf.id === editingRehearsal.performanceId) {
          return {
            ...perf,
            rehearsals: perf.rehearsals.filter((reh) => reh.id !== editingRehearsal.rehearsal.id),
          };
        }
        return perf;
      });
      updatePerformances(updated);
      setEditingRehearsal(null);
      setShowRehearsalForm(false);
    } catch (error) {
      console.error('Failed to delete rehearsal:', error);
      throw error;
    }
  };

  // Function to check if user is authenticated before performing actions
  const checkAuthentication = async (): Promise<boolean> => {
    try {
      // Check if we've confirmed authentication recently (within the last 5 minutes)
      const lastCheck = sessionStorage.getItem('lastAuthCheck');
      if (lastCheck) {
        const lastCheckTime = new Date(lastCheck).getTime();
        const now = new Date().getTime();
        const fiveMinutes = 5 * 60 * 1000;

        // If we've checked auth recently, don't check again
        if (now - lastCheckTime < fiveMinutes) {
          return true;
        }
      }

      console.log('Validating authentication before proceeding with operation');

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          // Add cache control to prevent browsers from caching the response
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        console.error('Authentication check failed:', response.status, response.statusText);

        if (response.status === 401) {
          // Check if we've already shown an auth error in the last minute to prevent spam
          const lastAuthError = sessionStorage.getItem('lastAuthError');
          const now = new Date().getTime();

          if (!lastAuthError || now - new Date(lastAuthError).getTime() > 60000) {
            // Store the error time to prevent multiple alerts
            sessionStorage.setItem('lastAuthError', new Date().toISOString());

            console.error('User session expired, redirect to sign-in');
            alert('Your session has expired. Please sign in again to continue.');

            // Use window.location for a full page reload to clear any stale state
            window.location.href = '/sign-in';
          }
          return false;
        }

        return false;
      }

      const data = await response.json();

      if (data.authenticated) {
        // Store the successful auth check time
        sessionStorage.setItem('lastAuthCheck', new Date().toISOString());
      }

      return !!data.authenticated;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  };

  // Upload to Google Drive
  async function uploadToDrive(videoBlob: Blob, thumbnail: Blob | string, metadata: Metadata) {
    try {
      // Validate session and tokens before starting upload
      if (typeof window !== 'undefined' && window.validateAllTokensForRecording) {
        console.log('Validating all tokens before upload attempt');
        const tokensValid = await window.validateAllTokensForRecording();
        
        if (!tokensValid) {
          console.error('Token validation failed before upload. Sessions may have expired.');
          
          // Show a more helpful error to the user
          const errorMessage = 'Your session has expired. Please refresh the page and try again.';
          alert(errorMessage);
          
          throw new Error('Session expired during upload');
        }
      }
      
      const formData = new FormData();
      formData.append('video', videoBlob, `${metadata.title}.mp4`);

      // If thumbnail is a string (base64), convert to Blob
      let thumbnailBlob: Blob;
      if (typeof thumbnail === 'string') {
        const response = await fetch(thumbnail);
        thumbnailBlob = await response.blob();
        formData.append('thumbnail', thumbnailBlob, `${metadata.title}_thumb.jpg`);
      } else {
        formData.append('thumbnail', thumbnail, `${metadata.title}_thumb.jpg`);
      }

      const performance = selectedPerformance;
      const performanceTitle = performance ? performance.title : 'Untitled Performance';
      let rehearsalTitle = 'Untitled Rehearsal';
      if (selectedPerformance) {
        const reh = selectedPerformance.rehearsals.find((r) => r.id === metadata.rehearsalId);
        if (reh) rehearsalTitle = reh.title;
      }

      formData.append('performanceId', selectedPerformanceId);
      formData.append('performanceTitle', performanceTitle);
      formData.append('rehearsalId', metadata.rehearsalId);
      formData.append('rehearsalTitle', rehearsalTitle);
      formData.append('recordingTitle', metadata.title);

      // Add error handling with retry for transient issues
      let retries = 2;
      let success = false;
      let lastError: Error | null = null;
      
      while (retries >= 0 && !success) {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
          });

          if (!res.ok) {
            // Check for specific error status codes
            if (res.status === 401 || res.status === 403) {
              // Session/auth errors
              console.error('Authentication error during upload, status:', res.status);
              
              // Try one session refresh before failing
              if (retries > 0 && typeof window !== 'undefined' && window.validateAllTokensForRecording) {
                console.log('Attempting token refresh before retry');
                await window.validateAllTokensForRecording();
              } else {
                throw new Error('Session expired during upload');
              }
            } else if (res.status >= 500) {
              // Server errors - may be temporary
              console.error('Server error during upload, will retry. Status:', res.status);
              
              // Wait before retrying for server errors
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                throw new Error(`Upload failed: Server error (${res.status})`);
              }
            } else {
              // Other client errors - likely not fixable by retry
              const errorText = await res.text();
              throw new Error(`Upload failed: ${res.status} - ${errorText || 'Unknown error'}`);
            }
          } else {
            // Success case
            success = true;
            return res.json();
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.error(`Upload attempt failed (${retries} retries left):`, lastError);
        }
        
        retries--;
      }
      
      // If we get here, all attempts failed
      throw lastError || new Error('Upload failed after multiple attempts');
    } catch (error) {
      console.error('Error during upload:', error);
      throw error;
    }
  }

  // Add recording (from any source)
  const addRecording = async (
    rehearsalId: string,
    videoBlob: Blob,
    thumbnail: Blob | string,
    metadata: Partial<Metadata> = {}
  ): Promise<string> => {
    try {
      // Validate session before proceeding
      let isAuthenticated = false;
      
      // Attempt validation using the most comprehensive method
      try {
        logWithTimestamp('UPLOAD', 'Validating session before adding recording');
        isAuthenticated = await validateAllTokensWithRetry(3);
        
        if (!isAuthenticated) {
          logWithTimestamp('ERROR', 'Session validation failed, cannot add recording');
          throw new Error('Session validation failed. Please refresh your session and try again.');
        }
      } catch (validationError) {
        logWithTimestamp('ERROR', 'Error validating session before recording', validationError);
        throw new Error('Error validating your session. Please refresh the page and try again.');
      }
      
      // Continue with adding the recording now that we have validated the session
      console.log('Adding recording:', { rehearsalId, metadata });

      if (!rehearsalId) {
        console.error('Cannot add recording: Missing rehearsalId');
        throw new Error('Missing rehearsalId');
      }

      // Find the performance this rehearsal belongs to
      const performanceId = Object.keys(performances).find(
        (perfId) => {
          const performance = performances.find(p => p.id === perfId);
          return performance && performance.rehearsals.some(r => r.id === rehearsalId);
        }
      );

      if (!performanceId) {
        console.error(`Cannot find performance for rehearsal ${rehearsalId}`);
        throw new Error(`Cannot find performance for rehearsal ${rehearsalId}`);
      }

      // Generate URLs for video and thumbnail
      const videoUrl = URL.createObjectURL(videoBlob);
      
      // Handle different thumbnail types
      let thumbnailUrl: string;
      if (typeof thumbnail === 'string') {
        // If it's already a string (likely a data URL), use it directly
        thumbnailUrl = thumbnail;
      } else {
        // Otherwise create a blob URL
        thumbnailUrl = URL.createObjectURL(thumbnail);
      }

      console.log('Generated URLs:', { videoUrl, thumbnailUrl });

      // Get relevant state using find instead of direct indexing
      const performance = performances.find(p => p.id === performanceId);
      if (!performance) {
        throw new Error(`Performance ${performanceId} not found`);
      }

      const rehearsal = performance.rehearsals.find(r => r.id === rehearsalId);
      if (!rehearsal) {
        throw new Error(`Rehearsal ${rehearsalId} not found in performance ${performanceId}`);
      }

      // Create recording object
      const defaultMetadata: Metadata = {
        title: metadata?.title || `Recording ${rehearsal.recordings.length + 1}`,
        time: metadata?.time || new Date().toISOString(),
        performers: metadata?.performers || [],
        tags: metadata?.tags || [],
        rehearsalId,
        notes: metadata?.notes || '',
        date: metadata?.date || new Date().toISOString().split('T')[0], // Add date
      };

      // Merge default metadata with provided metadata
      const mergedMetadata: Metadata = {
        ...defaultMetadata,
        ...(metadata || {}),
        rehearsalId, // Ensure these are always set correctly
      };

      // Create recording with all required fields
      const newRecording: Recording = {
        id: generateId(),
        title: mergedMetadata.title,
        time: mergedMetadata.time,
        date: mergedMetadata.date || new Date().toISOString().split('T')[0], // Ensure date is included
        videoUrl,
        thumbnailUrl,
        performers: mergedMetadata.performers,
        rehearsalId,
        tags: mergedMetadata.tags || [],
        notes: mergedMetadata.notes || '',
        sourceType: 'recorded', // Add required fields
      };

      console.log('Created new recording:', newRecording);

      // Update rehearsals and performances properly
      const updatedPerformances = performances.map(p => {
        if (p.id === performanceId) {
          // Update this performance
          return {
            ...p,
            rehearsals: p.rehearsals.map(r => {
              if (r.id === rehearsalId) {
                // Update this rehearsal
                return {
                  ...r,
                  recordings: [...r.recordings, newRecording]
                };
              }
              return r;
            })
          };
        }
        return p;
      });

      // Update state
      setPerformances(updatedPerformances);

      console.log('Updated state with new recording');

      // Save to storage with correct parameter structure
      try {
        const thumbnailBlob = typeof thumbnail === 'string' 
          ? await convertDataUrlToBlob(thumbnail) 
          : thumbnail;
        
        await videoStorage.saveVideo(
          newRecording.id,
          videoBlob,
          thumbnailBlob,
          {
            title: newRecording.title,
            performanceId: performanceId,
            rehearsalId: rehearsalId,
            createdAt: new Date().toISOString(),
            performers: newRecording.performers,
            tags: newRecording.tags || [],
          }
        );

        console.log('Saved recording to storage');
      } catch (storageError) {
        console.error('Error saving to storage:', storageError);
        // Continue execution even if storage fails
      }

      // Queue upload to server
      try {
        const thumbnailBlob = typeof thumbnail === 'string' 
          ? await convertDataUrlToBlob(thumbnail) 
          : thumbnail;
        
        await syncService.queueRecording(
          performanceId,
          performance.title || 'Untitled Performance',
          rehearsalId,
          videoBlob,
          thumbnailBlob,
          {
            title: newRecording.title,
            time: newRecording.time,
            performers: newRecording.performers,
            tags: newRecording.tags || [],
            notes: newRecording.notes || '',
            rehearsalId: rehearsalId,
            rehearsalTitle: rehearsal.title || 'Untitled Rehearsal'
          }
        );

        console.log('Queued recording for sync');
      } catch (syncError) {
        console.error('Error queuing for sync:', syncError);
        // Continue execution even if sync fails
      }

      return newRecording.id;
    } catch (error) {
      console.error('Error during recording:', error);
      throw error;
    }
  };

  const updateRecordingMetadata = (metadata: Metadata) => {
    if (!editingRecording) return;

    const updated = performances.map((perf) => {
      if (perf.id === selectedPerformanceId) {
        const updatedRehearsals = perf.rehearsals.map((reh) => {
          if (reh.id === editingRecording.rehearsalId) {
            const updatedRecordings = reh.recordings.map((rec) => {
              if (rec.id === editingRecording.recording.id) {
                return { ...rec, ...metadata, performers: metadata.performers, tags: metadata.tags };
              }
              return rec;
            });
            return { ...reh, recordings: updatedRecordings };
          }
          return reh;
        });
        return { ...perf, rehearsals: updatedRehearsals };
      }
      return perf;
    });

    updatePerformances(updated);
    setEditingRecording(null);
    setShowMetadataForm(false);
  };

  const deleteRecording = async () => {
    if (!editingRecording) return;

    try {
      const performance = performances.find(p => p.id === selectedPerformanceId);
      const rehearsal = performance?.rehearsals.find(r => r.id === editingRecording.rehearsalId);

      if (!performance || !rehearsal) {
        throw new Error('Performance or rehearsal not found');
      }

      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recording',
          performanceId: selectedPerformanceId,
          performanceTitle: performance.title,
          rehearsalId: editingRecording.rehearsalId,
          rehearsalTitle: rehearsal.title,
          recordingId: editingRecording.recording.id,
          recordingTitle: editingRecording.recording.title
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to delete from Google Drive: ${res.statusText}`);
      }

      // Remove from local storage
      await videoStorage.deleteVideo(editingRecording.recording.id);

      // Update local state
      const updated = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedRehearsals = perf.rehearsals.map((reh) => {
            if (reh.id === editingRecording.rehearsalId) {
              return {
                ...reh,
                recordings: reh.recordings.filter((rec) => rec.id !== editingRecording.recording.id),
              };
            }
            return reh;
          });
          return { ...perf, rehearsals: updatedRehearsals };
        }
        return perf;
      });

      updatePerformances(updated);
      setEditingRecording(null);
      setShowMetadataForm(false);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  };

  // Collections functions
  const createCollection = (data: { title: string; description?: string }) => {
    const newCollection: Collection = {
      id: generateId('col'),
      title: data.title,
      description: data.description,
      recordingIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCollections(prev => [...prev, newCollection]);
  };

  const updateCollection = (id: string, data: { title: string; description?: string }) => {
    setCollections(prev =>
      prev.map(collection =>
        collection.id === id
          ? {
            ...collection,
            ...data,
            updatedAt: new Date().toISOString()
          }
          : collection
      )
    );
  };

  const deleteCollection = (id: string) => {
    setCollections(prev => prev.filter(collection => collection.id !== id));
  };

  const addToCollection = (collectionId: string, recordingId: string) => {
    setCollections(prev =>
      prev.map(collection =>
        collection.id === collectionId && !collection.recordingIds.includes(recordingId)
          ? {
            ...collection,
            recordingIds: [...collection.recordingIds, recordingId],
            updatedAt: new Date().toISOString()
          }
          : collection
      )
    );
  };

  const removeFromCollection = (collectionId: string, recordingId: string) => {
    setCollections(prev =>
      prev.map(collection =>
        collection.id === collectionId
          ? {
            ...collection,
            recordingIds: collection.recordingIds.filter(id => id !== recordingId),
            updatedAt: new Date().toISOString()
          }
          : collection
      )
    );
  };

  // Add this function inside the PerformanceProvider component
  const findPerformanceIdByRehearsalId = (rehearsalId: string): string | undefined => {
    console.log('Finding performance for rehearsal ID:', rehearsalId);

    for (const performance of performances) {
      for (const rehearsal of performance.rehearsals) {
        if (rehearsal.id === rehearsalId) {
          console.log(`Found performance: ${performance.id} for rehearsal: ${rehearsalId}`);
          return performance.id;
        }
      }
    }

    console.error(`No performance found for rehearsal ID: ${rehearsalId}`);
    return undefined;
  };

  // New function to handle external video links
  const handleExternalVideoLink = (metadata: Metadata & { externalUrl: string }) => {
    const { rehearsalId, externalUrl, ...metadataWithoutUrl } = metadata;

    // Create a new recording with the external URL
    const newRecordingId = generateId('rec');
    const newRecording: Recording = {
      id: newRecordingId,
      title: metadata.title,
      time: metadata.time,
      date: new Date().toISOString(),
      performers: metadata.performers,
      notes: metadata.notes,
      tags: metadata.tags,
      isExternalLink: true,
      externalUrl: externalUrl,
      rehearsalId: rehearsalId,
      videoUrl: "",
      thumbnailUrl: '',
    };

    // Add the recording to the appropriate rehearsal
    setPerformances(prevPerformances => {
      return prevPerformances.map(performance => {
        const rehearsal = performance.rehearsals.find(r => r.id === rehearsalId);
        if (rehearsal) {
          const updatedRehearsal = {
            ...rehearsal,
            recordings: [...rehearsal.recordings, newRecording]
          };
          return {
            ...performance,
            rehearsals: performance.rehearsals.map(r =>
              r.id === rehearsalId ? updatedRehearsal : r
            )
          };
        }
        return performance;
      });
    });
  };

  // Helper function to convert data URL to Blob
  const convertDataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    return fetch(dataUrl).then(res => res.blob());
  };

  return (
    <PerformanceContext.Provider
      value={{
        // State
        performances,
        selectedPerformanceId,
        searchQuery,
        showRecorder,
        showMetadataForm,
        showPerformanceForm,
        showRehearsalForm,
        showPreRecordingMetadataForm,
        editingRecording,
        editingRehearsal,
        editingPerformance,
        recordingTargetRehearsalId,
        preRecordingMetadata,
        videoToWatch,

        // Add these state setters
        setShowRecorder,
        setPreRecordingMetadata,
        setRecordingTargetRehearsalId,

        // Computed Properties
        selectedPerformance,
        filteredRecordings,
        todaysRecordings,

        // Actions
        setSearchQuery,
        setSelectedPerformanceId,

        // Modal Controls
        openRecorder,
        closeRecorder,
        openPreRecordingMetadata,
        closePreRecordingMetadata,
        openMetadataForm,
        closeMetadataForm,
        openPerformanceForm,
        closePerformanceForm,
        openRehearsalForm,
        closeRehearsalForm,
        openVideoPlayer,
        closeVideoPlayer,

        // CRUD Operations
        addPerformance,
        updatePerformance,
        deletePerformance,
        addRehearsal,
        updateRehearsal,
        deleteRehearsal,
        addRecording,
        updateRecordingMetadata,
        deleteRecording,
        handlePreRecordingMetadataSubmit,
        collections,
        createCollection,
        updateCollection,
        deleteCollection,
        addToCollection,
        removeFromCollection,

        // State setters
        setPerformances,

        // New property
        handleExternalVideoLink,
      }}
    >
      {children}
    </PerformanceContext.Provider>
  );
};

export const usePerformances = () => {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformances must be used within a PerformanceProvider');
  }
  return context;
};