'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RedirectToSignIn, UserButton, useUser } from '@clerk/nextjs';
import VideoRecorder from '../components/VideoRecorder';
import MetadataForm from '../components/MetadataForm';
import VideoPlayer from '../components/VideoPlayer';
import RehearsalTimeline, { Performance, Section, Recording } from '../components/RehearsalTimeline';
import PerformanceForm from '../components/PerformanceForm';
import SectionForm from '../components/SectionForm';

type PendingVideo = {
  videoBlob: Blob;
  thumbnail: string;
};

type Metadata = {
  title: string;
  time: string;
  performers: string[];
  notes?: string;
  sectionId: string;
  tags: string[];
};

export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();

  // If no user is signed in, redirect them to sign in.
  if (!user) {
    return <RedirectToSignIn />;
  }

  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string>('');
  const [recordingTargetSectionId, setRecordingTargetSectionId] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState<boolean>(false);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);
  const [videoToWatch, setVideoToWatch] = useState<{ recording: Recording; videoUrl: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showPerformanceForm, setShowPerformanceForm] = useState<boolean>(false);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);

  const [showSectionForm, setShowSectionForm] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<{ performanceId: string; section: Section } | null>(null);

  const [editingRecording, setEditingRecording] = useState<{ sectionId: string; recording: Recording } | null>(null);

  // Initialize performances from localStorage if available; otherwise start empty.
  useEffect(() => {
    const savedPerformances = localStorage.getItem('performances');
    if (savedPerformances) {
      const parsed = JSON.parse(savedPerformances) as Performance[];
      setPerformances(parsed);
      if (parsed.length > 0) {
        setSelectedPerformanceId(parsed[0].id);
      }
    } else {
      setPerformances([]);
    }
  }, []);

  // Helper to update localStorage.
  const updatePerformances = (newPerformances: Performance[]) => {
    setPerformances(newPerformances);
    localStorage.setItem('performances', JSON.stringify(newPerformances));
  };

  const selectedPerformance = performances.find((p) => p.id === selectedPerformanceId);

  const sectionsForMetadata = selectedPerformance
    ? selectedPerformance.sections.map((sec) => ({
        id: sec.id,
        title: sec.title,
      }))
    : [];

  // Delete functions for recordings, sections, and performances (used within edit modals).
  const handleDeleteRecordingFromEdit = () => {
    if (editingRecording) {
      const updatedPerformances = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedSections = perf.sections.map((sec) => {
            if (sec.id === editingRecording.sectionId) {
              return {
                ...sec,
                recordings: sec.recordings.filter(
                  (rec) => rec.id !== editingRecording.recording.id
                ),
              };
            }
            return sec;
          });
          return { ...perf, sections: updatedSections };
        }
        return perf;
      });
      updatePerformances(updatedPerformances);
      setEditingRecording(null);
      setShowMetadataForm(false);
    }
  };

  const handleDeleteSectionFromEdit = () => {
    if (editingSection) {
      const updatedPerformances = performances.map((perf) => {
        if (perf.id === editingSection.performanceId) {
          return {
            ...perf,
            sections: perf.sections.filter(
              (sec) => sec.id !== editingSection.section.id
            ),
          };
        }
        return perf;
      });
      updatePerformances(updatedPerformances);
      setEditingSection(null);
      setShowSectionForm(false);
    }
  };

  const handleDeletePerformanceFromEdit = (performanceId: string) => {
    const updated = performances.filter((p) => p.id !== performanceId);
    updatePerformances(updated);
    if (updated.length > 0) {
      setSelectedPerformanceId(updated[0].id);
    } else {
      setSelectedPerformanceId('');
    }
    setEditingPerformance(null);
    setShowPerformanceForm(false);
  };

  // Save recording metadata.
  const handleMetadataSave = (metadata: Metadata) => {
    if (editingRecording) {
      const updatedPerformances = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedSections = perf.sections.map((sec) => {
            if (sec.id === editingRecording.sectionId) {
              const updatedRecordings = sec.recordings.map((rec) => {
                if (rec.id === editingRecording.recording.id) {
                  return {
                    ...rec,
                    ...metadata,
                    performers: metadata.performers,
                    tags: metadata.tags,
                  };
                }
                return rec;
              });
              return { ...sec, recordings: updatedRecordings };
            }
            return sec;
          });
          return { ...perf, sections: updatedSections };
        }
        return perf;
      });
      updatePerformances(updatedPerformances);
      setEditingRecording(null);
      setShowMetadataForm(false);
    } else if (pendingVideo) {
      const newRecording: Recording = {
        id: Date.now().toString(),
        title: metadata.title,
        time: metadata.time,
        performers: metadata.performers,
        notes: metadata.notes,
        videoBlob: pendingVideo.videoBlob,
        thumbnailUrl: pendingVideo.thumbnail,
        tags: metadata.tags,
      };
      const updatedPerformances = performances.map((perf) => {
        if (perf.id === selectedPerformanceId) {
          const updatedSections = perf.sections.map((sec) => {
            if (sec.id === metadata.sectionId) {
              return { ...sec, recordings: [...sec.recordings, newRecording] };
            }
            return sec;
          });
          return { ...perf, sections: updatedSections };
        }
        return perf;
      });
      updatePerformances(updatedPerformances);
      setPendingVideo(null);
      setShowMetadataForm(false);
      setRecordingTargetSectionId(null);
    }
  };

  const handleRecordingComplete = (videoData: PendingVideo) => {
    setPendingVideo(videoData);
    setShowRecorder(false);
    setShowMetadataForm(true);
  };

  // Fix for older videos: only call createObjectURL if videoBlob is a Blob.
  const handleWatchRecording = (sectionId: string, recording: Recording) => {
    let videoUrl;
    if (recording.videoBlob instanceof Blob) {
      videoUrl = URL.createObjectURL(recording.videoBlob);
    } else {
      videoUrl = recording.videoBlob;
    }
    setVideoToWatch({ recording, videoUrl });
  };

  const handleEditRecording = (sectionId: string, recording: Recording) => {
    setEditingRecording({ sectionId, recording });
    setPendingVideo(null);
    setShowMetadataForm(true);
  };

  const handleEditSection = (section: Section) => {
    setEditingSection({ performanceId: selectedPerformanceId, section });
    setShowSectionForm(true);
  };

  const handleEditPerformance = (performance: Performance) => {
    setEditingPerformance(performance);
    setShowPerformanceForm(true);
  };

  const handleNewPerformanceSave = (data: { title: string; defaultPerformers: string[] }) => {
    const newPerformance: Performance = {
      id: 'perf-' + Date.now(),
      title: data.title,
      defaultPerformers: data.defaultPerformers,
      sections: [],
    };
    const updatedPerformances = [...performances, newPerformance];
    updatePerformances(updatedPerformances);
    setSelectedPerformanceId(newPerformance.id);
    setShowPerformanceForm(false);
  };

  const handleEditPerformanceSave = (data: { title: string; defaultPerformers: string[] }) => {
    const updatedPerformances = performances.map((perf) => {
      if (perf.id === editingPerformance?.id) {
        return {
          ...perf,
          title: data.title,
          defaultPerformers: data.defaultPerformers,
        };
      }
      return perf;
    });
    updatePerformances(updatedPerformances);
    setEditingPerformance(null);
    setShowPerformanceForm(false);
  };

  const handleNewSectionSave = (data: { title: string; location: string; date: string }) => {
    const newSection = {
      id: 'sec-' + Date.now(),
      title: data.title,
      location: data.location,
      date: data.date,
      recordings: [],
    };
    const updatedPerformances = performances.map((perf) => {
      if (perf.id === selectedPerformanceId) {
        return { ...perf, sections: [...perf.sections, newSection] };
      }
      return perf;
    });
    updatePerformances(updatedPerformances);
    setShowSectionForm(false);
  };

  const handleEditSectionSave = (data: { title: string; location: string; date: string }) => {
    const updatedPerformances = performances.map((perf) => {
      if (perf.id === editingSection?.performanceId) {
        const updatedSections = perf.sections.map((sec) => {
          if (sec.id === editingSection?.section.id) {
            return {
              ...sec,
              title: data.title,
              location: data.location,
              date: data.date,
            };
          }
          return sec;
        });
        return { ...perf, sections: updatedSections };
      }
      return perf;
    });
    updatePerformances(updatedPerformances);
    setEditingSection(null);
    setShowSectionForm(false);
  };

  const handleRecordSection = (sectionId: string) => {
    setRecordingTargetSectionId(sectionId);
    setShowRecorder(true);
  };

  return (
    <div className="p-4">
      {/* Header with profile */}
      <header className="flex justify-between items-center p-4 bg-gray-200">
        <h1 className="text-2xl font-bold">StudioVault</h1>
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
          <button
            onClick={() => setShowPerformanceForm(true)}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
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
          onEditSection={handleEditSection}
          onNewSection={() => setShowSectionForm(true)}
          onEditPerformance={handleEditPerformance}
          onRecordSection={handleRecordSection}
        />
      ) : (
        <div className="text-center">Select a performance to view details.</div>
      )}

      {/* Video Recorder Modal */}
      {showRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <VideoRecorder onRecordingComplete={handleRecordingComplete} />
            <button
              onClick={() => {
                setShowRecorder(false);
                setRecordingTargetSectionId(null);
              }}
              className="mt-2 text-red-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Metadata Form Modal for New/Editing Recording */}
      {showMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <MetadataForm
              onSave={handleMetadataSave}
              onCancel={() => {
                setShowMetadataForm(false);
                setEditingRecording(null);
                setRecordingTargetSectionId(null);
              }}
              sections={sectionsForMetadata}
              availablePerformers={selectedPerformance ? selectedPerformance.defaultPerformers : []}
              initialValues={
                editingRecording
                  ? {
                      title: editingRecording.recording.title,
                      time: editingRecording.recording.time,
                      performers: editingRecording.recording.performers,
                      notes: editingRecording.recording.notes,
                      sectionId: editingRecording.sectionId,
                      tags: editingRecording.recording.tags,
                    }
                  : { sectionId: recordingTargetSectionId || '' }
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
                  ? {
                      title: editingPerformance.title,
                      defaultPerformers: editingPerformance.defaultPerformers,
                    }
                  : {}
              }
              onDelete={
                editingPerformance
                  ? () => handleDeletePerformanceFromEdit(editingPerformance.id)
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Section Form Modal */}
      {showSectionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <SectionForm
              onSave={editingSection ? handleEditSectionSave : handleNewSectionSave}
              onCancel={() => {
                setShowSectionForm(false);
                setEditingSection(null);
              }}
              initialData={
                editingSection
                  ? {
                      title: editingSection.section.title,
                      location: editingSection.section.location,
                      date: editingSection.section.date,
                    }
                  : {}
              }
              onDelete={editingSection ? handleDeleteSectionFromEdit : undefined}
            />
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoToWatch && (
        <VideoPlayer
          videoUrl={videoToWatch.videoUrl}
          onClose={() => setVideoToWatch(null)}
        />
      )}
    </div>
  );
}
