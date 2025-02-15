'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  date: string;
  time: string;
  performers: string[];
  notes?: string;
  sectionId: string;
};

export default function HomePage() {
  const router = useRouter();

  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string>('');
  const [showRecorder, setShowRecorder] = useState<boolean>(false);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);
  const [videoToWatch, setVideoToWatch] = useState<{ recording: Recording; videoUrl: string } | null>(null);

  const [showPerformanceForm, setShowPerformanceForm] = useState<boolean>(false);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);

  const [showSectionForm, setShowSectionForm] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<{ performanceId: string; section: Section } | null>(null);

  const [editingRecording, setEditingRecording] = useState<{ sectionId: string; recording: Recording } | null>(null);

  // Initialize default performance if none exist
  useEffect(() => {
    const savedPerformances = localStorage.getItem('performances');
    if (savedPerformances) {
      const parsed = JSON.parse(savedPerformances) as Performance[];
      setPerformances(parsed);
      if (parsed.length > 0) {
        setSelectedPerformanceId(parsed[0].id);
      }
    } else {
      const defaultPerformance: Performance = {
        id: "perf-1",
        title: "Autumn Performance 2024",
        defaultPerformers: [],
        sections: [{
          id: "sec-1",
          title: new Date().toLocaleDateString(),
          recordings: []
        }]
      };
      setPerformances([defaultPerformance]);
      setSelectedPerformanceId(defaultPerformance.id);
      localStorage.setItem('performances', JSON.stringify([defaultPerformance]));
    }
  }, []);

  // Helper to update localStorage
  const updatePerformances = (newPerformances: Performance[]) => {
    setPerformances(newPerformances);
    localStorage.setItem('performances', JSON.stringify(newPerformances));
  };

  const selectedPerformance = performances.find(p => p.id === selectedPerformanceId);

  // Guard clause: wait until a performance is selected before rendering the page
  if (!selectedPerformance) {
    return <div className="p-4">Loading performance...</div>;
  }

  const sectionsForMetadataForm = selectedPerformance.sections.map(sec => ({
    id: sec.id,
    title: sec.title
  }));

  // Authentication check
  useEffect(() => {
    const auth = localStorage.getItem('authenticated');
    if (!auth) {
      router.push('/login');
    }
  }, [router]);

  const handleRecordingComplete = (videoData: PendingVideo) => {
    setPendingVideo(videoData);
    setShowRecorder(false);
    setShowMetadataForm(true);
  };

  const handleMetadataSave = (metadata: Metadata) => {
    if (!pendingVideo) return;
    const newRecording: Recording = {
      id: Date.now().toString(),
      title: metadata.title,
      date: metadata.date,
      time: metadata.time,
      performers: metadata.performers,
      notes: metadata.notes,
      videoBlob: pendingVideo.videoBlob,
      thumbnailUrl: pendingVideo.thumbnail,
    };

    // Add recording to the selected section in the selected performance
    const updatedPerformances = performances.map(perf => {
      if (perf.id === selectedPerformanceId) {
        const updatedSections = perf.sections.map(sec => {
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
  };

  const handleWatchRecording = (sectionId: string, recording: Recording) => {
    const videoUrl = URL.createObjectURL(recording.videoBlob);
    setVideoToWatch({ recording, videoUrl });
  };

  // For editing recordings (placeholder—reuse metadata form)
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
      id: "perf-" + Date.now(),
      title: data.title,
      defaultPerformers: data.defaultPerformers,
      sections: [{
        id: "sec-" + Date.now(),
        title: new Date().toLocaleDateString(),
        recordings: []
      }]
    };
    const updatedPerformances = [...performances, newPerformance];
    updatePerformances(updatedPerformances);
    setSelectedPerformanceId(newPerformance.id);
    setShowPerformanceForm(false);
  };

  const handleEditPerformanceSave = (data: { title: string; defaultPerformers: string[] }) => {
    const updatedPerformances = performances.map(perf => {
      if (perf.id === editingPerformance?.id) {
        return { ...perf, title: data.title, defaultPerformers: data.defaultPerformers };
      }
      return perf;
    });
    updatePerformances(updatedPerformances);
    setEditingPerformance(null);
    setShowPerformanceForm(false);
  };

  const handleNewSectionSave = (data: { title: string }) => {
    const newSection = {
      id: "sec-" + Date.now(),
      title: data.title,
      recordings: []
    };
    const updatedPerformances = performances.map(perf => {
      if (perf.id === selectedPerformanceId) {
        return { ...perf, sections: [...perf.sections, newSection] };
      }
      return perf;
    });
    updatePerformances(updatedPerformances);
    setShowSectionForm(false);
  };

  const handleEditSectionSave = (data: { title: string }) => {
    const updatedPerformances = performances.map(perf => {
      if (perf.id === editingSection?.performanceId) {
        const updatedSections = perf.sections.map(sec => {
          if (sec.id === editingSection?.section.id) {
            return { ...sec, title: data.title };
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

  const sectionsForMetadata = selectedPerformance.sections.map(sec => ({
    id: sec.id,
    title: sec.title
  }));

  return (
    <div className="p-4">
      {/* Top Controls */}
      <div className="flex justify-between mb-4">
        <div>
          <button onClick={() => setShowPerformanceForm(true)} className="bg-purple-500 text-white px-4 py-2 rounded">
            New Performance
          </button>
        </div>
        <div>
          <button onClick={() => setShowRecorder(true)} className="bg-blue-500 text-white px-4 py-2 rounded">
            New Recording
          </button>
        </div>
      </div>

      {/* Timeline */}
      <RehearsalTimeline
        performance={selectedPerformance}
        performances={performances}
        onSelectPerformance={(id) => setSelectedPerformanceId(id)}
        onWatchRecording={handleWatchRecording}
        onEditRecording={handleEditRecording}
        onEditSection={handleEditSection}
        onNewSection={() => setShowSectionForm(true)}
        onEditPerformance={handleEditPerformance}
      />

      {/* Video Recorder Modal */}
      {showRecorder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <VideoRecorder onRecordingComplete={handleRecordingComplete} />
            <button onClick={() => setShowRecorder(false)} className="mt-2 text-red-500">
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
              }}
              sections={sectionsForMetadata}
              initialValues={editingRecording ? {
                title: editingRecording.recording.title,
                date: editingRecording.recording.date,
                time: editingRecording.recording.time,
                performers: editingRecording.recording.performers.join(', '),
                notes: editingRecording.recording.notes,
                sectionId: editingRecording.sectionId,
              } : {}}
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
              initialData={editingPerformance ? {
                title: editingPerformance.title,
                defaultPerformers: editingPerformance.defaultPerformers,
              } : {}}
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
              initialData={editingSection ? { title: editingSection.section.title } : {}}
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
