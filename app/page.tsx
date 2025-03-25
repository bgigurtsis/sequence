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
import { PendingVideo, Recording, Rehearsal, Performance, Metadata } from '../types';

import SyncStatus from '../components/SyncStatus';
import CalendarView from '../components/CalendarView';
import SearchBar from '../components/SearchBar';
import CollectionsView from '../components/CollectionsView';
import PerformanceSelector from '../components/PerformanceSelector';
import { generateId } from '../lib/utils';
import RecordingOptions from '../components/RecordingOptions';
import VideoLinkInput from '../components/VideoLinkInput';
import RecordingDetailsModal from '../components/RecordingDetailsModal';
import PreRecordingValidation from '../components/PreRecordingValidation';

// Add a utility function to format dates consistently
function formatDateForMetadata(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

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
    
    // Add these state setters
    setShowRecorder,
    setPreRecordingMetadata,
    setRecordingTargetRehearsalId,
    
    // Modal Controls
    openRecorder,
    closeRecorder,
    openPreRecordingMetadata,
    openMetadataForm,
    closeMetadataForm,
    openPerformanceForm,
    closePerformanceForm,
    openRehearsalForm,
    closeRehearsalForm,
    openVideoPlayer,
    closeVideoPlayer,
    
    // CRUD Operations
    addRecording,
    updateRecordingMetadata,
    deleteRecording,
    setPerformances,
    
    // Add these back to fix TypeScript errors
    deletePerformance,
    addRehearsal,
    updateRehearsal,
    deleteRehearsal,
  } = usePerformances();

  // New state for showing the upload component
  const [showUpload, setShowUpload] = useState(false);

  // Add new state for active view
  const [activeView, setActiveView] = useState<
    'performances' | 'calendar' | 'collections' | 'timeline'
  >('performances');

  // Inside HomePageContent component, add state for tracking recording UI flow
  const [recordingMode, setRecordingMode] = useState<'options' | 'record' | 'upload' | 'link' | 'metadata' | null>(null);

  // Add these state variables
  const [showUploader, setShowUploader] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Add missing state variables
  const [uploadedVideoBlob, setUploadedVideoBlob] = useState<Blob | null>(null);
  const [uploadedThumbnailBlob, setUploadedThumbnailBlob] = useState<Blob | null>(null);

  // Add new state for viewing recording details
  const [viewingRecordingDetails, setViewingRecordingDetails] = useState<Recording | null>(null);

  // Keep the local state declaration
  const [showPreRecordingMetadataForm, setShowPreRecordingMetadataForm] = useState(false);

  // Add a new state
  const [isValidatingSession, setIsValidatingSession] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);

  // Handler for video recording completion
  const handleVideoRecordingComplete = async (videoData: { videoBlob: Blob; thumbnail: string }) => {
    try {
      // Generate default metadata if none exists
      if (!preRecordingMetadata) {
        // Instead of throwing an error, create default metadata
        const defaultMetadata: Metadata = {
          title: `Recording at ${new Date().toLocaleTimeString()}`,
          time: new Date().toLocaleTimeString(),
          performers: [],
          rehearsalId: recordingTargetRehearsalId || '',
          tags: [],
          sourceType: 'recorded',
          date: formatDateForMetadata()
        };
        
        // If we have a rehearsal ID, proceed with the recording
        if (recordingTargetRehearsalId) {
          console.log('No pre-recording metadata found, using defaults');
          console.log('Created recording with date:', defaultMetadata.date);
          
          // Convert thumbnail to blob
          const response = await fetch(videoData.thumbnail);
          const thumbnailBlob = await response.blob();
          
          // Add the recording with default metadata
          await addRecording(
            recordingTargetRehearsalId,
            videoData.videoBlob, 
            thumbnailBlob, 
            defaultMetadata
          );
          
          // Close recorder and reset state
          setShowRecorder(false);
          setRecordingTargetRehearsalId(null);
          
          console.log('Recording successfully added with default metadata');
          return;
        } else {
          // If no rehearsal ID, we still can't proceed
          console.error('Missing rehearsal ID, cannot save recording');
          alert('Please select a rehearsal before recording');
          return;
        }
      }
      
      // Add date to metadata if not already present
      if (preRecordingMetadata) {
        if (!preRecordingMetadata.date) {
          preRecordingMetadata.date = formatDateForMetadata();
          console.log('Added date to metadata:', preRecordingMetadata.date);
        }
      }
      
      // Continue with the normal flow if metadata exists
      if (!recordingTargetRehearsalId) {
        console.error('Missing rehearsal ID');
        alert('Please select a rehearsal before recording');
        return;
      }
      
      console.log('Recording complete, processing with metadata:', preRecordingMetadata);
      
      // Convert thumbnail to blob
      const response = await fetch(videoData.thumbnail);
      const thumbnailBlob = await response.blob();
      
      // Add the recording with provided metadata
      await addRecording(
        recordingTargetRehearsalId,
        videoData.videoBlob, 
        thumbnailBlob, 
        preRecordingMetadata
      );
      
      // Close recorder and reset state
      setShowRecorder(false);
      setPreRecordingMetadata(null);
      setRecordingTargetRehearsalId(null);
      
      console.log('Recording successfully added');
    } catch (error) {
      console.error('Recording upload failed', error);
      alert('Failed to save recording. Please try again.');
    }
  };

  // Handler for video upload
  const handleVideoUpload = (videoBlob: Blob, thumbnailBlob: Blob, fileName?: string) => {
    console.log('Video upload received:', videoBlob.size, 'bytes', fileName);
    
    // Store the uploaded blobs
    setUploadedVideoBlob(videoBlob);
    setUploadedThumbnailBlob(thumbnailBlob);
    
    // Close the uploader
    setShowUploader(false);
    
    // If we have a rehearsal ID, open the pre-recording metadata form
    if (recordingTargetRehearsalId) {
      // Pre-populate metadata with file information
      setPreRecordingMetadata({
        title: fileName ? `${fileName.split('.')[0]}` : `Uploaded video ${new Date().toLocaleTimeString()}`,
        time: new Date().toLocaleTimeString(),
        performers: [],
        rehearsalId: recordingTargetRehearsalId,
        tags: ['uploaded'],
        sourceType: 'uploaded',
        fileName: fileName || 'uploaded-file.mp4', // Store the filename
        date: formatDateForMetadata()
      });
      
      // Show the metadata form
      setShowPreRecordingMetadataForm(true);
      setRecordingMode('metadata');
    }
  };

  // Computed properties
  const rehearsalsForMetadata = selectedPerformance?.rehearsals?.map((reh) => ({ id: reh.id, title: reh.title })) || [];

  const onWatchRecording = (rehearsalId: string, recording: Recording) => {
    openVideoPlayer(recording);
  };

  const onEditRehearsal = (rehearsal: Rehearsal) => {
    openRehearsalForm(selectedPerformanceId, rehearsal);
  };

  const onEditPerformance = (performance: Performance) => {
    openPerformanceForm(performance);
  };

  // Create local versions with different names to avoid redeclaration
  const handleAddPerformance = (data: { title: string; defaultPerformers: string[] }) => {
    const newPerformanceId = generateId('perf');
    const newPerformance: Performance = {
      id: newPerformanceId,
      title: data.title,
      defaultPerformers: data.defaultPerformers,
      rehearsals: []
    };
    
    setPerformances((prev: Performance[]) => [...prev, newPerformance]);
    setSelectedPerformanceId(newPerformanceId);
    closePerformanceForm();
  };

  const handleUpdatePerformance = (data: { title: string; defaultPerformers: string[] }) => {
    if (!editingPerformance) return;
    
    setPerformances((prevPerformances: Performance[]) => 
      prevPerformances.map((p: Performance) => 
        p.id === editingPerformance.id 
          ? { ...p, title: data.title, defaultPerformers: data.defaultPerformers }
          : p
      )
    );
    closePerformanceForm();
  };

  // Now modify the openRecorder function and add new functions
  const openRecordingOptions = (rehearsalId: string) => {
    setRecordingTargetRehearsalId(rehearsalId);
    setRecordingMode('options');
  };

  const startRecording = (rehearsalId: string) => {
    setRecordingTargetRehearsalId(rehearsalId);
    
    // Start with session validation
    setIsValidatingSession(true);
    setShowRecorder(true);
    setShowUpload(false);
    setRecordingMode('record');
  };

  const startUpload = (rehearsalId: string) => {
    console.log('Starting upload for rehearsal:', rehearsalId);
    setRecordingTargetRehearsalId(rehearsalId);
    setShowUploader(true);
    setRecordingMode('upload');
  };

  const startLinkInput = (rehearsalId: string) => {
    console.log('Starting link input for rehearsal:', rehearsalId);
    setRecordingTargetRehearsalId(rehearsalId);
    setShowLinkInput(true);
    setRecordingMode('link');
  };

  const closeRecordingOptions = () => {
    setRecordingMode(null);
    setRecordingTargetRehearsalId(null);
  };

  // Add handler for link submissions
  const handleVideoLinkSubmit = async (url: string, title: string) => {
    try {
      if (!recordingTargetRehearsalId) {
        throw new Error('No target rehearsal selected');
      }
      
      // Create metadata object with external URL
      const metadata: Metadata = {
        title,
        time: new Date().toLocaleString('en-US', { 
          hour: 'numeric', 
          minute: 'numeric',
          hour12: true 
        }),
        performers: [],
        rehearsalId: recordingTargetRehearsalId,
        tags: [],
        sourceType: 'external',
        externalUrl: url,
        date: formatDateForMetadata()
      };
      
      // Pass the metadata to the external video link handler
      await handleExternalVideoLink(metadata);
      
      // Close the link input
      setShowLinkInput(false);
      setRecordingTargetRehearsalId(null);
      setRecordingMode(null);
      
    } catch (error) {
      console.error('Failed to add video link:', error);
    }
  };

  // Now modify the openPreRecordingMetadata function to handle null
  const openPreRecordingMetadataWithSafety = (rehearsalId: string | null) => {
    if (rehearsalId) {
      openPreRecordingMetadata(rehearsalId);
    }
  };

  // Add function to view recording details
  const viewRecordingDetails = (recording: Recording) => {
    setViewingRecordingDetails(recording);
  };

  // Add function to close recording details
  const closeRecordingDetails = () => {
    setViewingRecordingDetails(null);
  };

  // Add helper function to find rehearsal ID
  const findRehearsalIdForRecording = (recordingId: string): string | null => {
    for (const performance of performances) {
      for (const rehearsal of performance.rehearsals) {
        const found = rehearsal.recordings.find(r => r.id === recordingId);
        if (found) {
          return rehearsal.id;
        }
      }
    }
    return null;
  };

  // We need to create wrapper functions for the RecordingOptions component
  const handleRecordInOptions = () => {
    const targetRehearsalId = recordingTargetRehearsalId;
    if (targetRehearsalId) {
      startRecording(targetRehearsalId);
    } else {
      console.error("No rehearsal ID available for recording");
    }
  };

  const handleUploadInOptions = () => {
    const targetRehearsalId = recordingTargetRehearsalId;
    if (targetRehearsalId) {
      startUpload(targetRehearsalId);
    } else {
      console.error("No rehearsal ID available for upload");
    }
  };

  const handleLinkInOptions = () => {
    const targetRehearsalId = recordingTargetRehearsalId;
    if (targetRehearsalId) {
      startLinkInput(targetRehearsalId);
    } else {
      console.error("No rehearsal ID available for link input");
    }
  };

  // And create a wrapper for onWatchRecording
  const handleWatchRecording = (rehearsalId: string, recording: Recording) => {
    openVideoPlayer(recording);
  };

  // Helper function to get domain from URL
  const getDomainFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'external';
    }
  };

  // Helper to generate initials thumbnail for a domain
  const generateDomainThumbnail = (domain: string): string => {
    // Extract initials from domain (e.g., "youtube.com" -> "YT")
    const parts = domain.split('.');
    const mainPart = parts[0] === 'www' ? parts[1] : parts[0];
    const initials = mainPart.substring(0, 2).toUpperCase();

    // Generate a simple SVG with the initials
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <rect width="120" height="120" fill="${color}" />
        <text x="60" y="60" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">
          ${initials}
        </text>
      </svg>
    `;

    return 'data:image/svg+xml;base64,' + btoa(svg);
  };

  // Update the handleExternalVideoLink function
  const handleExternalVideoLink = async (metadata: Metadata) => {
    try {
      const externalUrl = metadata.externalUrl || '';
      
      if (!externalUrl) {
        throw new Error('No external URL provided');
      }
      
      // Get domain and create thumbnail
      const domain = getDomainFromUrl(externalUrl);
      const thumbnailUrl = generateDomainThumbnail(domain);
      
      // Create a new recording with the link info
      const newRecording: Recording = {
        id: generateId('rec'),
        title: metadata.title,
        date: formatDateForMetadata(),
        time: metadata.time,
        performers: metadata.performers,
        notes: metadata.notes,
        rehearsalId: metadata.rehearsalId,
        videoUrl: externalUrl,
        thumbnailUrl: thumbnailUrl,
        tags: metadata.tags || [],
        isExternalLink: true,
        externalUrl: externalUrl,
        sourceType: 'external',
        domain: domain
      };
      
      // Add the recording
      await addRecording(
        metadata.rehearsalId,
        new Blob(), // Placeholder for videoBlob
        new Blob(), // Placeholder for thumbnailBlob
        metadata
      );
      
      return newRecording;
    } catch (error) {
      console.error('Failed to handle external video link:', error);
      throw error;
    }
  };

  // Add these wrapper functions to address type incompatibility with MetadataForm
  const handlePreRecordingMetadataSubmitWrapper = (formData: any) => {
    // Convert the form data to a proper Metadata object
    const metadata: Metadata = {
      title: formData.title,
      time: formData.time,
      performers: formData.performers || [],
      notes: formData.notes,
      rehearsalId: formData.rehearsalId,
      tags: formData.tags || [],
      sourceType: formData.sourceType as 'recorded' | 'uploaded' | 'external' | undefined,
      fileName: formData.fileName,
      externalUrl: formData.externalUrl,
      date: formData.date || formatDateForMetadata()
    };
    
    handlePreRecordingMetadataSubmit(metadata);
  };

  const updateRecordingMetadataWrapper = (formData: any) => {
    // Convert the form data to a proper Metadata object
    const metadata: Metadata = {
      title: formData.title,
      time: formData.time,
      performers: formData.performers || [],
      notes: formData.notes,
      rehearsalId: formData.rehearsalId,
      tags: formData.tags || [],
      sourceType: formData.sourceType as 'recorded' | 'uploaded' | 'external' | undefined,
      fileName: formData.fileName,
      externalUrl: formData.externalUrl,
      date: formData.date || formatDateForMetadata()
    };
    
    updateRecordingMetadata(metadata);
  };

  // Add this function near your other functions to transform the format
  const getMetadataFromEditingRecording = () => {
    if (!editingRecording) return undefined;
    
    // If it has a 'recording' property (the { rehearsalId, recording } format)
    if ('recording' in editingRecording) {
      const recording = editingRecording.recording;
      return {
        title: recording.title,
        time: recording.time,
        performers: recording.performers,
        notes: recording.notes,
        rehearsalId: recording.rehearsalId,
        tags: recording.tags,
        sourceType: recording.sourceType,
        externalUrl: recording.externalUrl,
        date: recording.date // Include the date property
      };
    }
    
    // If it's already in the right format, use it directly
    return editingRecording as Partial<Metadata>;
  };

  // Then modify the deleteRecording handler to use this function
  const handleDeleteRecording = () => {
    if (!editingRecording) return;
    
    if ('recording' in editingRecording) {
      // This format has a recording property with the ID
      deleteRecording();
      console.log('Deleted recording:', editingRecording.recording.id);
    } else if (editingRecording) {
      deleteRecording();
      console.log('Deleted recording');
    }
  };

  // Update the handlePreRecordingMetadataSubmit function
  const handlePreRecordingMetadataSubmit = async (metadata: Metadata) => {
    try {
      console.log('Pre-recording metadata submitted:', metadata);
      
      // Check if we have the necessary data
      if (!recordingTargetRehearsalId) {
        throw new Error('Missing rehearsal ID');
      }
      
      // Handle different recording types
      if (metadata.sourceType === 'uploaded' && uploadedVideoBlob && uploadedThumbnailBlob) {
        // For uploaded files
        console.log('Processing uploaded file with metadata');
        
        await addRecording(
          recordingTargetRehearsalId,
          uploadedVideoBlob,
          uploadedThumbnailBlob,
          metadata
        );
        
        // Reset state
        setUploadedVideoBlob(null);
        setUploadedThumbnailBlob(null);
      } 
      else if (metadata.sourceType === 'external' && metadata.externalUrl) {
        // For external links
        await handleExternalVideoLink(metadata);
      }
      else {
        // For recorded videos, continue with normal recording flow
        console.log('Continuing with recording flow');
        setPreRecordingMetadata(metadata);
        setRecordingMode('record');
        setShowRecorder(true);
        setShowPreRecordingMetadataForm(false);
        return;
      }
      
      // Close forms and reset state for all types
      setShowPreRecordingMetadataForm(false);
      setRecordingTargetRehearsalId(null);
      setRecordingMode(null);
      
    } catch (error) {
      console.error('Failed to process metadata:', error);
    }
  };

  // Update the closePreRecordingMetadata function
  const closePreRecordingMetadata = () => {
    setShowPreRecordingMetadataForm(false);
    setPreRecordingMetadata(null);
    setRecordingMode('options');
    
    // Also reset any uploaded blobs
    setUploadedVideoBlob(null);
    setUploadedThumbnailBlob(null);
  };

  // Add a handler for validation completion
  const handleValidationComplete = (isValid: boolean) => {
    setIsValidatingSession(false);
    setIsSessionValid(isValid);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <header className="flex justify-between items-center p-4 bg-gray-200 rounded-lg mb-6">
        <h1 className="text-2xl font-bold">StageVault</h1>
        <div className="flex items-center space-x-4">
          <SyncStatus />
          <UserButton />
        </div>
      </header>
      
      {/* View tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveView('performances')}
          className={`px-4 py-2 font-medium ${
            activeView === 'performances' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Performances
        </button>
        <button
          onClick={() => setActiveView('calendar')}
          className={`px-4 py-2 font-medium ${
            activeView === 'calendar' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveView('collections')}
          className={`px-4 py-2 font-medium ${
            activeView === 'collections' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveView('timeline')}
          className={`px-4 py-2 font-medium ${
            activeView === 'timeline' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Timeline
        </button>
      </div>
      
      <div className="flex flex-col md:flex-row md:space-x-6">
        <aside className="md:w-1/3 lg:w-1/4 mb-6 md:mb-0">
          <TodaysRecordings />
          
          <div className="mt-4 flex md:hidden">
            <SearchBar 
              onSearch={(query, dateRange) => {
                setSearchQuery(query);
                // Handle date range here if needed
              }} 
            />
          </div>
        </aside>
        
        <main className="md:flex-1">
          <div className="hidden md:block mb-4">
            <SearchBar 
              onSearch={(query, dateRange) => {
                setSearchQuery(query);
                // Handle date range here if needed
              }} 
            />
          </div>
          
          {/* Content varies based on active view */}
          {activeView === 'performances' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Performances</h2>
                <button
                  onClick={() => openPerformanceForm()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Plus size={20} className="mr-2" /> New Performance
                </button>
              </div>
              
              {performances.length === 0 ? (
                <div className="bg-white p-8 rounded-lg text-center">
                  <h3 className="text-lg font-medium mb-2">No performances yet</h3>
                  <p className="text-gray-500 mb-4">Create your first performance to get started</p>
                  <button
                    onClick={() => openPerformanceForm()}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                  >
                    Create Performance
                  </button>
                </div>
              ) : (
                <PerformanceSelector
                  selectedPerformanceId={selectedPerformance?.id || ''}
                  performances={performances}
                  searchQuery={searchQuery}
                  onSelectPerformance={setSelectedPerformanceId}
                  onWatchRecording={handleWatchRecording}
                  onEditRehearsal={(rehearsal) => openRehearsalForm(selectedPerformance!.id, rehearsal)}
                  onEditPerformance={(performance) => openPerformanceForm(performance)}
                  onRecordRehearsal={startRecording}
                  onUploadRecording={startUpload}
                  onLinkRecording={startLinkInput}
                  onNewRehearsal={
                    selectedPerformance ? 
                    () => openRehearsalForm(selectedPerformance.id) : 
                    undefined
                  }
                  onEditRecording={openMetadataForm}
                />
              )}
            </>
          )}
          
          {activeView === 'calendar' && <CalendarView />}
          
          {activeView === 'collections' && <CollectionsView />}
          
          {activeView === 'timeline' && <RehearsalTimeline />}
        </main>
      </div>

      {/* Pre-recording Metadata Form Modal */}
      {showPreRecordingMetadataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Recording Details</h2>
            <MetadataForm
              onSave={handlePreRecordingMetadataSubmitWrapper}
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
            
            {isValidatingSession ? (
              <PreRecordingValidation onValidationComplete={handleValidationComplete} />
            ) : isSessionValid ? (
              <VideoRecorder onRecordingComplete={handleVideoRecordingComplete} />
            ) : (
              <div className="py-4 px-2 text-center">
                <p className="text-red-600 mb-4">Session validation failed. Please try again.</p>
                <button
                  onClick={() => {
                    setIsValidatingSession(true);
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md"
                >
                  Retry Validation
                </button>
              </div>
            )}
            
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
              onVideoSelected={handleVideoUpload} 
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
              onSave={updateRecordingMetadataWrapper}
              onCancel={closeMetadataForm}
              rehearsals={rehearsalsForMetadata}
              availablePerformers={selectedPerformance ? selectedPerformance.defaultPerformers : []}
              initialValues={getMetadataFromEditingRecording()}
              onDelete={editingRecording ? handleDeleteRecording : undefined}
              isEditing={true}
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
              onSave={editingPerformance ? handleUpdatePerformance : handleAddPerformance}
              onCancel={closePerformanceForm}
              initialValues={
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

      {/* Then add the modal for RecordingOptions */}
      {recordingMode === 'options' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <RecordingOptions
            onRecord={handleRecordInOptions}
            onUpload={handleUploadInOptions}
            onLinkVideo={handleLinkInOptions}
          />
        </div>
      )}

      {/* And add the VideoUpload component */}
      {showUploader && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <VideoUpload
            onVideoSelected={handleVideoUpload}
            onCancel={() => {
              setShowUploader(false);
              setRecordingMode('options');
            }}
            allowLinkInput={false}
          />
        </div>
      )}

      {/* And add the VideoLinkInput component */}
      {showLinkInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
          <VideoLinkInput
            onLinkSubmit={handleVideoLinkSubmit}
            onCancel={() => {
              setShowLinkInput(false);
              setRecordingMode('options');
            }}
          />
        </div>
      )}

      {/* Recording Details Modal */}
      {viewingRecordingDetails && (
        <RecordingDetailsModal
          recording={viewingRecordingDetails}
          onClose={closeRecordingDetails}
          onEdit={() => {
            // Find the rehearsal ID for this recording
            const rehearsalId = findRehearsalIdForRecording(viewingRecordingDetails.id);
            if (rehearsalId) {
              openMetadataForm(rehearsalId, viewingRecordingDetails);
              closeRecordingDetails();
            }
          }}
        />
      )}
    </div>
  );
}
