// contexts/PerformanceContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Performance, Rehearsal, Recording, Metadata, Collection } from '../types';
import { videoStorage } from '../services/videoStorage';
import { syncService } from '../services/syncService';
import { generateId } from '../lib/utils';

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
  addRecording: (rehearsalId: string, videoBlob: Blob, thumbnailBlob: Blob, metadata: Metadata) => Promise<string>;
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

  // Upload to Google Drive
  async function uploadToDrive(videoBlob: Blob, thumbnail: Blob | string, metadata: Metadata) {
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

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error('Upload failed');
    }
    
    return res.json();
  }

  // Add recording (from any source)
  const addRecording = async (
    rehearsalId: string,
    videoBlob: Blob,
    thumbnailBlob: Blob,
    metadata: Metadata
  ): Promise<string> => {
    console.log('Adding recording:', { rehearsalId, metadata });
    
    if (!rehearsalId) {
      console.error('Cannot add recording: Missing rehearsalId');
      throw new Error('Missing rehearsalId');
    }

    try {
      // Find performance ID
      const performanceId = findPerformanceIdByRehearsalId(rehearsalId);
      if (!performanceId) {
        throw new Error('Could not find performance for rehearsal');
      }
      
      // Generate URLs for video and thumbnail
      const videoUrl = URL.createObjectURL(videoBlob);
      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
      
      console.log('Generated URLs:', { videoUrl, thumbnailUrl });

      // Find the performance and rehearsal
      const performance = performances.find(p => p.id === performanceId);
      
      if (!performance) {
        console.error('Cannot add recording: Performance not found for rehearsal', rehearsalId);
        throw new Error('Performance not found');
      }
      
      const rehearsal = performance.rehearsals.find(r => r.id === rehearsalId);
      if (!rehearsal) {
        console.error('Cannot add recording: Rehearsal not found', rehearsalId);
        throw new Error('Rehearsal not found');
      }
      
      console.log('Found performance and rehearsal:', { 
        performanceId, 
        performanceTitle: performance.title,
        rehearsalId,
        rehearsalTitle: rehearsal.title
      });

      // Create recording object with full metadata
      const newRecording: Recording = {
        id: 'rec-' + Date.now(),
        title: metadata.title || 'Untitled Recording',
        time: metadata.time || new Date().toLocaleTimeString(),
        performers: metadata.performers || [],
        notes: metadata.notes,
        rehearsalId: rehearsalId,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl,
        tags: metadata.tags || [],
        sourceType: 'recorded',
        localCopyAvailable: true,
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
        performanceTitle: performance.title,
        rehearsalTitle: rehearsal.title,
        date: new Date().toISOString(),
      };
      
      console.log('Created new recording object:', newRecording);

      // Update rehearsal with new recording
      const updatedRehearsals = rehearsal.recordings
        ? [...rehearsal.recordings, newRecording]
        : [newRecording];
        
      const updatedRehearsal = {
        ...rehearsal,
        recordings: updatedRehearsals
      };
      
      // Update performance with updated rehearsal
      const updatedPerformance = {
        ...performance,
        rehearsals: performance.rehearsals.map(r => 
          r.id === rehearsalId ? updatedRehearsal : r
        )
      };
      
      // Update performances state
      const updatedPerformances = performances.map(p => 
        p.id === performanceId ? updatedPerformance : p
      );
      
      console.log('Updating performances with new recording');
      updatePerformances(updatedPerformances);
      
      // Save video to local storage
      await videoStorage.saveVideo(
        newRecording.id,
        videoBlob,
        thumbnailBlob,
        {
          title: newRecording.title,
          performanceId: performanceId!,
          rehearsalId,
          createdAt: new Date().toISOString(),
          performers: newRecording.performers,
          tags: newRecording.tags
        }
      );
      console.log('Video saved to local storage');
      
      // Queue for server sync
      syncService.queueRecording(
        performanceId!,
        performance.title,
        rehearsalId,
        videoBlob,
        thumbnailBlob,
        {
          title: newRecording.title,
          time: newRecording.time,
          performers: newRecording.performers,
          notes: newRecording.notes,
          rehearsalId: newRecording.rehearsalId,
          tags: newRecording.tags,
          rehearsalTitle: rehearsal.title
        }
      );
      console.log('Recording queued for sync');
      
      return newRecording.id;
    } catch (error) {
      console.error('Error adding recording:', error);
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