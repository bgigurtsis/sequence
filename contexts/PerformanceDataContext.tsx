'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Performance, Rehearsal, Recording, Metadata, Collection } from '../types';
import { videoStorage } from '../services/videoStorage';
import { syncService } from '../services/syncService';
import { generateId } from '../lib/utils';
import { logWithTimestamp } from '@/lib/sessionUtils';
import { useAuthStatus } from '@/hooks/useAuthStatus';

interface PerformanceDataContextType {
  // Core data
  performances: Performance[];
  collections: Collection[];
  
  // State setters
  setPerformances: React.Dispatch<React.SetStateAction<Performance[]>>;
  
  // CRUD Operations for performances
  addPerformance: (data: { title: string; defaultPerformers: string[] }) => void;
  updatePerformance: (performanceId: string, data: { title: string; defaultPerformers: string[] }) => void;
  deletePerformance: (performanceId: string) => Promise<void>;
  
  // CRUD Operations for rehearsals
  addRehearsal: (performanceId: string, data: { title: string; location: string; date: string }) => void;
  updateRehearsal: (performanceId: string, rehearsalId: string, data: { title: string; location: string; date: string }) => void;
  deleteRehearsal: (performanceId: string, rehearsalId: string) => Promise<void>;
  
  // CRUD Operations for recordings
  addRecording: (rehearsalId: string, videoBlob: Blob, thumbnail: Blob | string, metadata?: Partial<Metadata>) => Promise<string>;
  updateRecordingMetadata: (performanceId: string, rehearsalId: string, recordingId: string, metadata: Metadata) => void;
  deleteRecording: (performanceId: string, rehearsalId: string, recordingId: string) => Promise<void>;
  handleExternalVideoLink: (metadata: Metadata & { externalUrl: string }) => void;
  
  // CRUD Operations for collections
  createCollection: (data: { title: string; description?: string }) => void;
  updateCollection: (id: string, data: { title: string; description?: string }) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string, recordingId: string) => void;
  removeFromCollection: (collectionId: string, recordingId: string) => void;
  
  // Helper functions
  findPerformanceIdByRehearsalId: (rehearsalId: string) => string | undefined;
}

const PerformanceDataContext = createContext<PerformanceDataContextType | undefined>(undefined);

export const PerformanceDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core data states
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  
  // Auth hook for validation
  const { validateAuth } = useAuthStatus();

  // Initialize performances from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('performances');
    if (saved) {
      const parsed = JSON.parse(saved) as Performance[];
      setPerformances(parsed);
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

  // CRUD Operations for performances
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
  };

  const updatePerformance = (performanceId: string, data: { title: string; defaultPerformers: string[] }) => {
    const updated = performances.map((perf) => {
      if (perf.id === performanceId) {
        return { ...perf, title: data.title, defaultPerformers: data.defaultPerformers };
      }
      return perf;
    });
    updatePerformances(updated);
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

  // CRUD Operations for rehearsals
  const addRehearsal = (performanceId: string, data: { title: string; location: string; date: string }) => {
    const newRehearsal = {
      id: 'reh-' + Date.now(),
      title: data.title,
      location: data.location,
      date: data.date,
      recordings: [],
    };
    const updated = performances.map((perf) => {
      if (perf.id === performanceId) {
        return { ...perf, rehearsals: [...perf.rehearsals, newRehearsal] };
      }
      return perf;
    });
    updatePerformances(updated);
  };

  const updateRehearsal = (performanceId: string, rehearsalId: string, data: { title: string; location: string; date: string }) => {
    const updated = performances.map((perf) => {
      if (perf.id === performanceId) {
        const updatedRehearsals = perf.rehearsals.map((reh) => {
          if (reh.id === rehearsalId) {
            return { ...reh, title: data.title, location: data.location, date: data.date };
          }
          return reh;
        });
        return { ...perf, rehearsals: updatedRehearsals };
      }
      return perf;
    });
    updatePerformances(updated);
  };

  const deleteRehearsal = async (performanceId: string, rehearsalId: string) => {
    try {
      const performance = performances.find(p => p.id === performanceId);
      if (!performance) {
        throw new Error('Performance not found');
      }
      
      const rehearsal = performance.rehearsals.find(r => r.id === rehearsalId);
      if (!rehearsal) {
        throw new Error('Rehearsal not found');
      }

      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'rehearsal',
          performanceId,
          performanceTitle: performance.title,
          rehearsalId,
          rehearsalTitle: rehearsal.title
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to delete from Google Drive: ${res.statusText}`);
      }

      // Update local state
      const updated = performances.map((perf) => {
        if (perf.id === performanceId) {
          return {
            ...perf,
            rehearsals: perf.rehearsals.filter((reh) => reh.id !== rehearsalId),
          };
        }
        return perf;
      });
      updatePerformances(updated);
    } catch (error) {
      console.error('Failed to delete rehearsal:', error);
      throw error;
    }
  };

  // Check authentication before upload
  const checkAuthentication = async (): Promise<boolean> => {
    try {
      logWithTimestamp('AUTH', 'Checking authentication before upload');
      return await validateAuth(true);
    } catch (error) {
      logWithTimestamp('ERROR', 'Authentication check failed', error);
      return false;
    }
  };

  // Create a function to add items to sync queue
  const addToSyncQueue = async (
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    video: Blob,
    thumbnail: Blob,
    metadata: any
  ) => {
    // Create a sync item
    const syncItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      performanceId,
      performanceTitle,
      rehearsalId,
      video,
      thumbnail,
      metadata,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending' as 'pending'
    };
    
    console.log('Adding to sync queue:', syncItem);
    
    // Trigger a sync attempt
    syncService.sync();
    
    return syncItem.id;
  };

  // Helper function to convert data URL to Blob
  const convertDataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    return fetch(dataUrl).then(res => res.blob());
  };

  // CRUD Operations for recordings
  const addRecording = async (
    rehearsalId: string,
    videoBlob: Blob,
    thumbnail: Blob | string,
    metadata: Partial<Metadata> = {}
  ): Promise<string> => {
    try {
      // Validate session before proceeding
      let isAuthenticated = false;
      
      try {
        logWithTimestamp('UPLOAD', 'Validating session before adding recording');
        isAuthenticated = await validateAuth(true);
        
        if (!isAuthenticated) {
          logWithTimestamp('ERROR', 'Session validation failed, cannot add recording');
          throw new Error('Session validation failed. Please refresh your session and try again.');
        }
      } catch (validationError) {
        logWithTimestamp('ERROR', 'Error validating session before recording', validationError);
        throw new Error('Error validating your session. Please refresh the page and try again.');
      }
      
      console.log('Adding recording:', { rehearsalId, metadata });

      if (!rehearsalId) {
        console.error('Cannot add recording: Missing rehearsalId');
        throw new Error('Missing rehearsalId');
      }

      // Find the performance this rehearsal belongs to
      const performanceId = findPerformanceIdByRehearsalId(rehearsalId);

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
        date: metadata?.date || new Date().toISOString().split('T')[0],
      };

      // Merge default metadata with provided metadata
      const mergedMetadata: Metadata = {
        ...defaultMetadata,
        ...(metadata || {}),
        rehearsalId,
      };

      // Create recording with all required fields
      const newRecording: Recording = {
        id: generateId(),
        title: mergedMetadata.title,
        time: mergedMetadata.time,
        date: mergedMetadata.date || new Date().toISOString().split('T')[0],
        videoUrl,
        thumbnailUrl,
        performers: mergedMetadata.performers,
        rehearsalId,
        tags: mergedMetadata.tags || [],
        notes: mergedMetadata.notes || '',
        sourceType: 'recorded',
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
        const finalMetadata = mergedMetadata;
        const thumbnailBlob = typeof thumbnail === 'string' 
          ? await convertDataUrlToBlob(thumbnail) 
          : thumbnail;
        
        await addToSyncQueue(
          performanceId,
          performance.title || 'Untitled Performance',
          rehearsalId,
          videoBlob,
          thumbnailBlob,
          finalMetadata
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

  const updateRecordingMetadata = (performanceId: string, rehearsalId: string, recordingId: string, metadata: Metadata) => {
    const updated = performances.map((perf) => {
      if (perf.id === performanceId) {
        const updatedRehearsals = perf.rehearsals.map((reh) => {
          if (reh.id === rehearsalId) {
            const updatedRecordings = reh.recordings.map((rec) => {
              if (rec.id === recordingId) {
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
  };

  const deleteRecording = async (performanceId: string, rehearsalId: string, recordingId: string) => {
    try {
      const performance = performances.find(p => p.id === performanceId);
      const rehearsal = performance?.rehearsals.find(r => r.id === rehearsalId);
      const recording = rehearsal?.recordings.find(r => r.id === recordingId);

      if (!performance || !rehearsal || !recording) {
        throw new Error('Performance, rehearsal, or recording not found');
      }

      const res = await fetch('/api/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recording',
          performanceId,
          performanceTitle: performance.title,
          rehearsalId,
          rehearsalTitle: rehearsal.title,
          recordingId,
          recordingTitle: recording.title
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to delete from Google Drive: ${res.statusText}`);
      }

      // Remove from local storage
      await videoStorage.deleteVideo(recordingId);

      // Update local state
      const updated = performances.map((perf) => {
        if (perf.id === performanceId) {
          const updatedRehearsals = perf.rehearsals.map((reh) => {
            if (reh.id === rehearsalId) {
              return {
                ...reh,
                recordings: reh.recordings.filter((rec) => rec.id !== recordingId),
              };
            }
            return reh;
          });
          return { ...perf, rehearsals: updatedRehearsals };
        }
        return perf;
      });

      updatePerformances(updated);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  };

  // CRUD Operations for collections
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

  // Helper function to find performance by rehearsal ID
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

    // Find the performance this rehearsal belongs to
    const performanceId = findPerformanceIdByRehearsalId(rehearsalId);
    if (!performanceId) {
      console.error(`Cannot find performance for rehearsal ${rehearsalId}`);
      return;
    }

    // Add the recording to the appropriate rehearsal
    setPerformances(prevPerformances => {
      return prevPerformances.map(performance => {
        if (performance.id === performanceId) {
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
        }
        return performance;
      });
    });
  };

  return (
    <PerformanceDataContext.Provider
      value={{
        // Core data
        performances,
        collections,
        
        // State setters
        setPerformances,
        
        // CRUD Operations for performances
        addPerformance,
        updatePerformance,
        deletePerformance,
        
        // CRUD Operations for rehearsals
        addRehearsal,
        updateRehearsal,
        deleteRehearsal,
        
        // CRUD Operations for recordings
        addRecording,
        updateRecordingMetadata,
        deleteRecording,
        handleExternalVideoLink,
        
        // CRUD Operations for collections
        createCollection,
        updateCollection,
        deleteCollection,
        addToCollection,
        removeFromCollection,
        
        // Helper functions
        findPerformanceIdByRehearsalId
      }}
    >
      {children}
    </PerformanceDataContext.Provider>
  );
};

export const usePerformanceData = () => {
  const context = useContext(PerformanceDataContext);
  if (context === undefined) {
    throw new Error('usePerformanceData must be used within a PerformanceDataProvider');
  }
  return context;
}; 