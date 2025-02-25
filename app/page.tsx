// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { RedirectToSignIn, UserButton, useUser } from '@clerk/nextjs';
import { Camera, Upload, Plus } from 'lucide-react';
import { PerformanceProvider, usePerformances } from '../contexts/PerformanceContext';
import VideoRecorder from '../components/VideoRecorder';
import MetadataForm from '../components/MetadataForm';
import VideoPlayer from '../components/VideoPlayer';
import RehearsalTimeline from '../components/RehearsalTimeline';
import PerformanceForm from '../components/PerformanceForm';
import RehearsalForm from '../components/RehearsalForm';
import VideoUpload from '../components/VideoUpload';
import TodaysRecordings from '../components/TodaysRecordings';
import { PendingVideo } from '../types';

// Main Page Component (Wrapper with PerformanceProvider)
export default function HomePage() {
  const { user } = useUser();

  if (!user) {
    return <RedirectToSignIn />;
  }

  return (
    <PerformanceProvider>
      <HomePageContent />
    </PerformanceProvider>
  );
}

// Content Component (Uses context)
function HomePageContent() {
  const { 
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
    selectedPerformance,

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
  } = usePerformances();

  // New state for showing the upload component
  const [showUpload, setShowUpload] = useState(false);

  // Handler for video recording completion
  const handleRecordingComplete = async (videoData: PendingVideo) => {
    try {
      if (!preRecordingMetadata) throw new Error('Missing metadata');
      await addRecording(videoData.videoBlob, videoData.thumbnail, preRecordingMetadata);
    } catch (error) {
      console.error('Recording upload failed', error);
    }
  };

  // Handler for video upload
  const handleVideoSelected = async (videoBlob: Blob, thumbnailBlob: Blob) => {
    try {
      if (!preRecordingMetadata) throw new Error('Missing metadata');
      await addRecording(videoBlob, thumbnailBlob, preRecordingMetadata);
      setShowUpload(false);
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  // Computed properties
  const rehearsalsForMetadata = selectedPerformance?.rehearsals?.map((reh) => ({ id: reh.id, title: reh.title })) || [];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-gray-200 rounded-lg mb-6">
        <h1 className="text-2xl font-bold">StageVault</h1>
        <UserButton />
      </header>

      {/* Today's Recordings Section */}
      <TodaysRecordings />

      {/* Search Bar */}
      <div className="mb-4">
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
          <button onClick={() => openPerformanceForm()} className="bg-purple-500 text-white px-4 py-2 rounded flex items-center">
            <Plus size={16} className="mr-1" />
            New Performance
          </button>
        </div>

        {selectedPerformance && (
          <div className="flex space-x-2">
            <button 
              onClick={() => openPreRecordingMetadata(selectedPerformance.rehearsals[0]?.id)} 
              className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
              disabled={!selectedPerformance.rehearsals.length}
            >
              <Camera size={16} className="mr-1" />
              Record
            </button>
            <button 
              onClick={() => {
                openPreRecordingMetadata(selectedPerformance.rehearsals[0]?.id);
                setShowUpload(true);
              }} 
              className="bg-green-500 text-white px-4 py-2 rounded flex items-center"
              disabled={!selectedPerformance.rehearsals.length}
            >
              <Upload size={16} className="mr-1" />
              Upload
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      {selectedPerformance ? (
        <RehearsalTimeline
          performance={selectedPerformance}
          performances={performances}
          searchQuery={searchQuery}
          onSelectPerformance={setSelectedPerformanceId}
          onWatchRecording={(rehearsalId, recording) => openVideoPlayer(recording)}
          onEditRecording={openMetadataForm}
          onEditRehearsal={(rehearsal) => openRehearsalForm(selectedPerformanceId, rehearsal)}
          onNewRehearsal={() => openRehearsalForm(selectedPerformanceId)}
          onEditPerformance={(performance) => openPerformanceForm(performance)}
          onRecordRehearsal={openPreRecordingMetadata}
        />
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No performances yet. Create your first performance to get started.</p>
          <button 
            onClick={() => openPerformanceForm()} 
            className="bg-purple-500 text-white px-6 py-3 rounded-lg font-medium"
          >
            Create Performance
          </button>
        </div>
      )}

      {/* Pre-recording Metadata Form Modal */}
      {showPreRecordingMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Recording Details</h2>
            <MetadataForm
              onSave={handlePreRecordingMetadataSubmit}
              onCancel={closePreRecordingMetadata}
              rehearsals={rehearsalsForMetadata}
              availablePerformers={selectedPerformance ? selectedPerformance.defaultPerformers : []}
              initialValues={{ rehearsalId: recordingTargetRehearsalId || '' }}
            />
          </div>
        </div>
      )}

      {/* Video Recorder or Upload Modal */}
      {showRecorder && !showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Record Video</h2>
            <VideoRecorder onRecordingComplete={handleRecordingComplete} />
            <button
              onClick={closeRecorder}
              className="mt-4 text-red-500 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {showRecorder && showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
            <VideoUpload 
              onVideoSelected={handleVideoSelected} 
              onCancel={() => {
                closeRecorder();
                setShowUpload(false);
              }} 
            />
          </div>
        </div>
      )}

      {/* Metadata Form Modal for Editing Recording */}
      {showMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Edit Recording</h2>
            <MetadataForm
              onSave={updateRecordingMetadata}
              onCancel={closeMetadataForm}
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
              onDelete={deleteRecording}
            />
          </div>
        </div>
      )}

      {/* Performance Form Modal */}
      {showPerformanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {editingPerformance ? 'Edit Performance' : 'New Performance'}
            </h2>
            <PerformanceForm
              onSave={editingPerformance ? updatePerformance : addPerformance}
              onCancel={closePerformanceForm}
              initialData={
                editingPerformance
                  ? { title: editingPerformance.title, defaultPerformers: editingPerformance.defaultPerformers }
                  : {}
              }
              onDelete={editingPerformance ? () => deletePerformance(editingPerformance.id) : undefined}
            />
          </div>
        </div>
      )}

      {/* Rehearsal Form Modal */}
      {showRehearsalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {editingRehearsal ? 'Edit Rehearsal' : 'New Rehearsal'}
            </h2>
            <RehearsalForm
              onSave={editingRehearsal ? updateRehearsal : addRehearsal}
              onCancel={closeRehearsalForm}
              initialData={
                editingRehearsal
                  ? {
                      title: editingRehearsal.rehearsal.title,
                      location: editingRehearsal.rehearsal.location,
                      date: editingRehearsal.rehearsal.date,
                    }
                  : {}
              }
              onDelete={editingRehearsal ? deleteRehearsal : undefined}
            />
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoToWatch && (
        <VideoPlayer 
          videoUrl={videoToWatch.videoUrl} 
          recordingId={videoToWatch.recording.id}
          onClose={closeVideoPlayer} 
        />
      )}
    </div>
  );
}