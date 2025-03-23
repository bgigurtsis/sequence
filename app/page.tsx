// app/page.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import SimplePerformanceSelector from '@/components/SimplePerformanceSelector';
import PerformanceSelector from '@/components/PerformanceSelector';
import VideoRecorder from '@/components/VideoRecorder';
import RecordingList from '@/components/RecordingList';
import VideoPlayer from '@/components/VideoPlayer';
import { Recording, Rehearsal } from '@/types';
import { Home, Plus, Video, ArrowLeft } from 'lucide-react';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [selectedRehearsal, setSelectedRehearsal] = useState<Rehearsal | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'performances' | 'recordings'>('performances');

  const {
    isInitialized,
    isLoading,
    needsGoogleAuth,
    connectToGoogle,
    performances
  } = useGoogleDrive();

  // Show loading state while auth is loading
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated with Clerk
  if (!isSignedIn) {
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
    return null;
  }

  // Show Google Drive connection prompt if needed
  if (needsGoogleAuth) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Connect to Google Drive</h1>
        <p className="text-gray-600 mb-6">
          StageVault needs access to Google Drive to store your recordings and performance data securely.
        </p>
        <button
          onClick={connectToGoogle}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Google Drive
        </button>
      </div>
    );
  }

  // Show initialization message if needed
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing Google Drive connection...</p>
        </div>
      </div>
    );
  }

  // Handle watching a recording
  const handleWatchRecording = (rehearsalId: string, recording: Recording) => {
    setSelectedRecording(recording);
  };

  // Handle selecting a rehearsal
  const handleSelectRehearsal = (rehearsal: Rehearsal) => {
    setSelectedRehearsal(rehearsal);
    // Switch to recordings tab on mobile when a rehearsal is selected
    if (window.innerWidth < 768) {
      setActiveTab('recordings');
    }
  };

  // Handle back button on mobile
  const handleBackToPerformances = () => {
    if (selectedRecording) {
      setSelectedRecording(null);
    } else if (activeTab === 'recordings') {
      setActiveTab('performances');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="bg-white shadow-sm py-4 px-4 md:hidden sticky top-0 z-10">
        <div className="flex justify-between items-center">
          {activeTab === 'recordings' || selectedRecording ? (
            <button
              onClick={handleBackToPerformances}
              className="flex items-center text-gray-700"
            >
              <ArrowLeft size={20} className="mr-1" />
              {selectedRecording ? 'Back to Recordings' : 'Back'}
            </button>
          ) : (
            <h1 className="text-xl font-bold">StageVault</h1>
          )}

          {selectedRehearsal && !selectedRecording && !isRecording && (
            <button
              onClick={() => setIsRecording(true)}
              className="bg-blue-600 text-white p-2 rounded-full"
            >
              <Plus size={20} />
            </button>
          )}
        </div>

        {selectedRehearsal && !selectedRecording && activeTab === 'recordings' && (
          <div className="mt-2">
            <h2 className="text-lg font-medium">{selectedRehearsal.title}</h2>
            <div className="text-sm text-gray-500">
              {selectedRehearsal.date} • {selectedRehearsal.location}
            </div>
          </div>
        )}
      </header>

      {/* Mobile tabs navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab('performances')}
            className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'performances' ? 'text-blue-600' : 'text-gray-500'
              }`}
          >
            <Home size={20} />
            <span className="text-xs mt-1">Performances</span>
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'recordings' ? 'text-blue-600' : 'text-gray-500'
              } ${!selectedRehearsal ? 'opacity-50 pointer-events-none' : ''}`}
            disabled={!selectedRehearsal}
          >
            <Video size={20} />
            <span className="text-xs mt-1">Recordings</span>
          </button>
        </div>
      </div>

      {/* Mobile content */}
      <div className="md:hidden pb-16">
        {activeTab === 'performances' ? (
          <div className="p-4">
            <PerformanceSelector
              onWatchRecording={handleWatchRecording}
              onSelectRehearsal={handleSelectRehearsal}
            />
          </div>
        ) : selectedRehearsal ? (
          <div className="p-4">
            {isRecording ? (
              <VideoRecorder
                rehearsalId={selectedRehearsal.id}
                onRecordingComplete={() => setIsRecording(false)}
              />
            ) : selectedRecording ? (
              <VideoPlayer
                recording={selectedRecording}
                onClose={() => setSelectedRecording(null)}
              />
            ) : (
              <RecordingList
                rehearsalId={selectedRehearsal.id}
                onSelectRecording={setSelectedRecording}
              />
            )}
          </div>
        ) : (
          <div className="p-4 text-center py-20">
            <p className="text-gray-500">Select a rehearsal to view recordings</p>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex min-h-screen">
        {/* Sidebar */}
        <div className="w-1/4 bg-white shadow-md p-6 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-6">StageVault</h1>
          <PerformanceSelector
            onWatchRecording={handleWatchRecording}
            onSelectRehearsal={handleSelectRehearsal}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedRehearsal ? (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{selectedRehearsal.title}</h2>
                  <div className="text-sm text-gray-500">
                    {selectedRehearsal.date} • {selectedRehearsal.location}
                  </div>
                </div>
                {!isRecording && !selectedRecording && (
                  <button
                    onClick={() => setIsRecording(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Video size={16} className="mr-2" />
                    Record Video
                  </button>
                )}
              </div>

              {isRecording ? (
                <VideoRecorder
                  rehearsalId={selectedRehearsal.id}
                  onRecordingComplete={() => setIsRecording(false)}
                />
              ) : selectedRecording ? (
                <VideoPlayer
                  recording={selectedRecording}
                  onClose={() => setSelectedRecording(null)}
                />
              ) : (
                <RecordingList
                  rehearsalId={selectedRehearsal.id}
                  onSelectRecording={setSelectedRecording}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <h2 className="text-xl font-semibold mb-2">Select a Rehearsal</h2>
              <p className="text-gray-500">Choose a rehearsal from the sidebar to view recordings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
