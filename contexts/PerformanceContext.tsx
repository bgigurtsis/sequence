// contexts/PerformanceContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Performance, Rehearsal, Recording, Metadata } from '../types';
import { videoStorage } from '../services/videoStorage';

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
  addRecording: (videoBlob: Blob, thumbnail: string, metadata: Metadata) => Promise<void>;
  updateRecordingMetadata: (metadata: Metadata) => void;
  deleteRecording: () => Promise<void>;
  handlePreRecordingMetadataSubmit: (metadata: Metadata) => void;
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

  // Helper function to update performances state
  const updatePerformances = (newPerformances: Performance[]) => {
    setPerformances(newPerformances);
    localStorage.setItem('performances', JSON.stringify(newPerformances));
  };

  // Computed properties
  const selectedPerformance = performances.find((p) => p.id === selectedPerformanceId);

  // Get today's recordings
  const todaysRecordings = React.useMemo(() => {
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
  const filteredRecordings = React.useMemo(() => {
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
    setPreRecordingMetadata(metadata);
    setShowPreRecordingMetadataForm(false);
    setShowRecorder(true);
    setRecordingTargetRehearsalId(metadata.rehearsalId);
  };

  // CRUD operations
  const addPerformance = (data: { title: string; defaultPerformers: string[] }) => {
    const newPerformance = {
      id: 'perf-' + Date.now(),
      title: data.title,
      defaultPerformers: data.defaultPerformers,
      rehearsals: [],
    };
    const updated = [...performances, newPerformance];
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
      if (!performance) throw new Error('Performance not found');
  
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
        throw new Error(`Failed to delete from Google Drive: ${res.statusText}`);
      }
  
      // Update local state
      const updated = performances.filter((p) => p.id !== performanceId);
      updatePerformances(updated);
      setSelectedPerformanceId(updated.length > 0 ? updated[0].id : '');
      setEditingPerformance(null);
      setShowPerformanceForm(false);
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
  async function uploadToDrive(videoBlob: Blob, thumbnail: string | Blob, metadata: Metadata) {
    const formData = new FormData();
    formData.append('video', videoBlob, `${metadata.title}.mp4`);
    
    // If thumbnail is a string (base64), convert to Blob
    if (typeof thumbnail === 'string') {
      const response = await fetch(thumbnail);
      const thumbBlob = await response.blob();
      formData.append('thumbnail', thumbBlob, `${metadata.title}_thumb.jpg`);
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
  const addRecording = async (videoBlob: Blob, thumbnail: string | Blob, metadata: Metadata) => {
    try {
      // Upload to Google Drive
      const uploaded = await uploadToDrive(videoBlob, thumbnail, metadata);
      
      // Create new recording object
      const newRecording: Recording = {
        id: Date.now().toString(),
        title: metadata.title,
        time: metadata.time,
        performers: metadata.performers,
        notes: metadata.notes,
        rehearsalId: metadata.rehearsalId,
        videoUrl: uploaded.videoUrl,
        thumbnailUrl: typeof thumbnail === 'string' ? thumbnail : URL.createObjectURL(thumbnail),
        tags: metadata.tags,
        sourceType: 'recorded',
        createdAt: new Date().toISOString(),
      };
      
      // Store video in local storage for faster playback
      await videoStorage.saveVideo(
        newRecording.id,
        videoBlob,
        typeof thumbnail === 'string' ? await (await fetch(thumbnail)).blob() : thumbnail,
        {
          title: metadata.title,
          performanceId: selectedPerformanceId,
          rehearsalId: metadata.rehearsalId,
          createdAt: newRecording.createdAt || new Date().toISOString(),
          performers: metadata.performers,
          tags: metadata.tags,
        }
      );
      
      // Update performances state
      const updated = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedRehearsals = perf.rehearsals.map((reh) => {
            if (reh.id === metadata.rehearsalId) {
              return { ...reh, recordings: [...reh.recordings, newRecording] };
            }
            return reh;
          });
          return { ...perf, rehearsals: updatedRehearsals };
        }
        return perf;
      });
      
      updatePerformances(updated);
      setPreRecordingMetadata(null);
      setShowRecorder(false);
    } catch (error) {
      console.error('Upload failed', error);
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