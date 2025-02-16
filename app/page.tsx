'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectToSignIn, UserButton, useUser } from '@clerk/nextjs';
import VideoRecorder from '../components/VideoRecorder';
import MetadataForm from '../components/MetadataForm';
import VideoPlayer from '../components/VideoPlayer';
import RehearsalTimeline, { Performance, Rehearsal, Recording } from '../components/RehearsalTimeline';
import PerformanceForm from '../components/PerformanceForm';
import RehearsalForm from '../components/RehearsalForm';

type Metadata = {
  title: string;
  time: string;
  performers: string[];
  notes?: string;
  rehearsalId: string;
  tags: string[];
};

type PendingVideo = {
  videoBlob: Blob;
  thumbnail: string;
};

export default function HomePage() {
  // First, declare all state variables
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

  const { user } = useUser();
  const router = useRouter();

  // Initialize performances from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem('performances');
      if (saved) {
        const parsed = JSON.parse(saved) as Performance[];
        setPerformances(parsed);
        if (parsed.length > 0) {
          setSelectedPerformanceId(parsed[0].id);
        }
      }
    }
  }, [user]);

  if (!user) {
    return <RedirectToSignIn />;
  }

  const updatePerformances = (newPerformances: Performance[]) => {
    setPerformances(newPerformances);
    localStorage.setItem('performances', JSON.stringify(newPerformances));
  };

  const selectedPerformance = performances.find((p) => p.id === selectedPerformanceId);
  const rehearsalsForMetadata = selectedPerformance?.rehearsals?.map((reh) => ({ id: reh.id, title: reh.title })) || [];

  

  // Function for updating an existing recording's metadata
  const handleMetadataSave = (metadata: Metadata) => {
    if (editingRecording) {
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
    }
  };

  const handleDeleteRecordingFromEdit = async () => {
    if (editingRecording) {
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
  
        const responseData = await res.json();
        console.log('Delete API response:', responseData);
  
        if (!res.ok) {
          throw new Error(`Failed to delete from Google Drive: ${responseData.error}`);
        }
  
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
        alert('Failed to delete recording. Please try again.');
      }
    }
  };
  
  const handleDeleteRehearsalFromEdit = async () => {
    if (editingRehearsal) {
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
  
        const responseData = await res.json();
        console.log('Delete API response:', responseData);
  
        if (!res.ok) {
          throw new Error(`Failed to delete from Google Drive: ${responseData.error}`);
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
        alert('Failed to delete rehearsal. Please try again.');
      }
    }
  };
  
  const handleDeletePerformanceFromEdit = async (performanceId: string) => {
    try {
      const performance = performances.find(p => p.id === performanceId);
      
      if (!performance) {
        throw new Error('Performance not found');
      }
  
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
  
      const responseData = await res.json();
      console.log('Delete API response:', responseData);
  
      if (!res.ok) {
        throw new Error(`Failed to delete from Google Drive: ${responseData.error}`);
      }
  
      // Update local state
      const updated = performances.filter((p) => p.id !== performanceId);
      updatePerformances(updated);
      setSelectedPerformanceId(updated.length > 0 ? updated[0].id : '');
      setEditingPerformance(null);
      setShowPerformanceForm(false);
    } catch (error) {
      console.error('Failed to delete performance:', error);
      alert('Failed to delete performance. Please try again.');
    }
  };
  
  // Pre-recording metadata flow
  const handlePreRecordingMetadataSubmit = (metadata: Metadata) => {
    setPreRecordingMetadata(metadata);
    setShowPreRecordingMetadataForm(false);
    setShowRecorder(true);
    setRecordingTargetRehearsalId(metadata.rehearsalId);
  };

  // Upload function using pre-recording metadata
  async function uploadToDrive(videoBlob: Blob, thumbnail: string, metadata: Metadata) {
    const thumbResponse = await fetch(thumbnail);
    const thumbBlob = await thumbResponse.blob();

    const formData = new FormData();
    formData.append('video', videoBlob, `${metadata.title}.mp4`);
    formData.append('thumbnail', thumbBlob, `${metadata.title}_thumb.jpg`);
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

  const handleRecordingComplete = async (videoData: { videoBlob: Blob; thumbnail: string }) => {
    try {
      if (!preRecordingMetadata) throw new Error('Missing metadata');
      const uploaded = await uploadToDrive(videoData.videoBlob, videoData.thumbnail, preRecordingMetadata);
      const newRecording = {
        id: Date.now().toString(),
        title: preRecordingMetadata.title,
        time: preRecordingMetadata.time,
        performers: preRecordingMetadata.performers,
        notes: preRecordingMetadata.notes,
        videoUrl: uploaded.videoUrl,
        thumbnailUrl: videoData.thumbnail,
        tags: preRecordingMetadata.tags,
      };
      const updated = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedRehearsals = perf.rehearsals.map((reh) => {
            if (reh.id === preRecordingMetadata.rehearsalId) {
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
    }
  };

  const handleWatchRecording = (rehearsalId: string, recording: Recording) => {
    setVideoToWatch({ recording, videoUrl: recording.videoUrl });
  };

  const handleEditRecording = (rehearsalId: string, recording: Recording) => {
    setEditingRecording({ rehearsalId, recording });
    setShowMetadataForm(true);
  };

  const handleEditRehearsal = (rehearsal: Rehearsal) => {
    setEditingRehearsal({ performanceId: selectedPerformanceId, rehearsal });
    setShowRehearsalForm(true);
  };

  const handleEditPerformance = (performance: Performance) => {
    setEditingPerformance(performance);
    setShowPerformanceForm(true);
  };

  const handleNewPerformanceSave = (data: { title: string; defaultPerformers: string[] }) => {
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

  const handleEditPerformanceSave = (data: { title: string; defaultPerformers: string[] }) => {
    const updated = performances.map((perf) => {
      if (perf.id === editingPerformance?.id) {
        return { ...perf, title: data.title, defaultPerformers: data.defaultPerformers };
      }
      return perf;
    });
    updatePerformances(updated);
    setEditingPerformance(null);
    setShowPerformanceForm(false);
  };

  const handleNewRehearsalSave = (data: { title: string; location: string; date: string }) => {
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

  const handleEditRehearsalSave = (data: { title: string; location: string; date: string }) => {
    const updated = performances.map((perf) => {
      if (perf.id === editingRehearsal?.performanceId) {
        const updatedRehearsals = perf.rehearsals.map((reh) => {
          if (reh.id === editingRehearsal?.rehearsal.id) {
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

  const handleRecordRehearsal = (rehearsalId: string) => {
    setRecordingTargetRehearsalId(rehearsalId);
    setShowPreRecordingMetadataForm(true);
  };
  
  return (
    <div className="p-4">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-gray-200">
        <h1 className="text-2xl font-bold">StageVault</h1>
        <UserButton />
      </header>

      {/* Search Bar */}
      <div className="mb-4 mt-4">
        <input
          type="text"
          placeholder="Search recordings by title, performers, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </div>

      {/* Top Controls */}
      <div className="flex justify-between mb-4">
        <div>
          <button onClick={() => setShowPerformanceForm(true)} className="bg-purple-500 text-white px-4 py-2 rounded">
            New Performance
          </button>
        </div>
      </div>

      {/* Timeline */}
      {selectedPerformance ? (
        <RehearsalTimeline
          performance={selectedPerformance}
          performances={performances}
          searchQuery={searchQuery}
          onSelectPerformance={(id) => setSelectedPerformanceId(id)}
          onWatchRecording={handleWatchRecording}
          onEditRecording={handleEditRecording}
          onEditRehearsal={handleEditRehearsal}
          onNewRehearsal={() => setShowRehearsalForm(true)}
          onEditPerformance={handleEditPerformance}
          onRecordRehearsal={handleRecordRehearsal}
        />
      ) : (
        <div className="text-center">Select a performance to view details.</div>
      )}

{/* Pre-recording Metadata Form Modal */}
{showPreRecordingMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <MetadataForm
              onSave={handlePreRecordingMetadataSubmit}
              onCancel={() => setShowPreRecordingMetadataForm(false)}
              rehearsals={rehearsalsForMetadata}
              availablePerformers={selectedPerformance ? selectedPerformance.defaultPerformers : []}
              initialValues={{ rehearsalId: recordingTargetRehearsalId || '' }}
            />
          </div>
        </div>
      )}

      {/* Video Recorder Modal */}
      {showRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <VideoRecorder onRecordingComplete={handleRecordingComplete} />
            <button
              onClick={() => {
                setShowRecorder(false);
                setRecordingTargetRehearsalId(null);
              }}
              className="mt-2 text-red-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metadata Form Modal for Editing Recording */}
      {showMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <MetadataForm
              onSave={handleMetadataSave}
              onCancel={() => {
                setShowMetadataForm(false);
                setEditingRecording(null);
                setRecordingTargetRehearsalId(null);
              }}
              rehearsals={rehearsalsForMetadata}
              availablePerformers={selectedPerformance ? selectedPerformance.defaultPerformers : []}
              initialValues={
                editingRecording
                  ? {
                      title: editingRecording.recording.title,
                      time: editingRecording.recording.time,
                      performers: editingRecording.recording.performers,
                      notes: editingRecording.recording.notes,
                      rehearsalId: editingRecording.rehearsalId,
                      tags: editingRecording.recording.tags,
                    }
                  : { rehearsalId: recordingTargetRehearsalId || '' }
              }
              onDelete={editingRecording ? handleDeleteRecordingFromEdit : undefined}
            />
          </div>
        </div>
      )}

      {/* Performance Form Modal */}
      {showPerformanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <PerformanceForm
              onSave={editingPerformance ? handleEditPerformanceSave : handleNewPerformanceSave}
              onCancel={() => {
                setShowPerformanceForm(false);
                setEditingPerformance(null);
              }}
              initialData={
                editingPerformance
                  ? { title: editingPerformance.title, defaultPerformers: editingPerformance.defaultPerformers }
                  : {}
              }
              onDelete={editingPerformance ? () => handleDeletePerformanceFromEdit(editingPerformance.id) : undefined}
            />
          </div>
        </div>
      )}

      {/* Rehearsal Form Modal */}
      {showRehearsalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <RehearsalForm
              onSave={editingRehearsal ? handleEditRehearsalSave : handleNewRehearsalSave}
              onCancel={() => {
                setShowRehearsalForm(false);
                setEditingRehearsal(null);
              }}
              initialData={
                editingRehearsal
                  ? {
                      title: editingRehearsal.rehearsal.title,
                      location: editingRehearsal.rehearsal.location,
                      date: editingRehearsal.rehearsal.date,
                    }
                  : {}
              }
              onDelete={editingRehearsal ? handleDeleteRehearsalFromEdit : undefined}
            />
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoToWatch && (
        <VideoPlayer videoUrl={videoToWatch.videoUrl} onClose={() => setVideoToWatch(null)} />
      )}
    </div>
  );
}