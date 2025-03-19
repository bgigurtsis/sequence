// app/page.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { GoogleDriveProviderWithQueryClient } from '@/contexts/GoogleDriveContext';
import SimplePerformanceSelector from '@/components/SimplePerformanceSelector';
import VideoRecorder from '@/components/VideoRecorder';
import RecordingList from '@/components/RecordingList';
import VideoPlayer from '@/components/VideoPlayer';
import { Recording, Rehearsal } from '@/types';
import { Home, Plus, Video } from 'lucide-react';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [selectedRehearsal, setSelectedRehearsal] = useState<Rehearsal | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'performances' | 'recordings'>('performances');
  
  // Show loading state while auth is loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
    return null;
  }

  return (
    <GoogleDriveProviderWithQueryClient>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile header */}
        <header className="bg-white shadow-sm py-4 px-4 md:hidden sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">StageVault</h1>
            <button 
              onClick={() => setIsRecording(true)}
              className="bg-blue-600 text-white p-2 rounded-full"
            >
              <Plus size={20} />
            </button>
          </div>
        </header>
        
        {/* Desktop layout */}
        <div className="hidden md:flex min-h-screen">
          {/* Sidebar */}
          <div className="w-1/4 bg-white shadow-md p-6 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">StageVault</h1>
            <SimplePerformanceSelector />
          </div>
          
          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedRehearsal ? (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">{selectedRehearsal.title}</h2>
                  <button
                    onClick={() => setIsRecording(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Video size={16} className="mr-2" />
                    Record Video
                  </button>
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
        
        {/* Mobile layout */}
        <div className="md:hidden">
          <div className="p-4">
            {activeTab === 'performances' ? (
              <SimplePerformanceSelector />
            ) : selectedRehearsal ? (
              isRecording ? (
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
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{selectedRehearsal.title}</h2>
                    <p className="text-sm text-gray-500">{selectedRehearsal.date}</p>
                  </div>
                  <RecordingList 
                    rehearsalId={selectedRehearsal.id}
                    onSelectRecording={setSelectedRecording}
                  />
                </div>
              )
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500">Select a rehearsal to view recordings</p>
              </div>
            )}
          </div>
          
          {/* Mobile navigation */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center py-3">
            <button 
              onClick={() => {
                setActiveTab('performances');
                setSelectedRecording(null);
              }}
              className={`flex flex-col items-center ${
                activeTab === 'performances' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Home size={20} />
              <span className="text-xs mt-1">Performances</span>
            </button>
            <button
              onClick={() => {
                if (selectedRehearsal) {
                  setActiveTab('recordings');
                }
              }}
              className={`flex flex-col items-center ${
                activeTab === 'recordings' ? 'text-blue-600' : 'text-gray-500'
              } ${!selectedRehearsal ? 'opacity-50' : ''}`}
              disabled={!selectedRehearsal}
            >
              <Video size={20} />
              <span className="text-xs mt-1">Recordings</span>
            </button>
            <button
              onClick={() => {
                if (selectedRehearsal) {
                  setIsRecording(true);
                }
              }}
              className="flex flex-col items-center text-gray-500"
              disabled={!selectedRehearsal}
            >
              <div className="bg-blue-600 text-white rounded-full p-3 -mt-8 shadow-md">
                <Plus size={20} />
              </div>
              <span className="text-xs mt-1">Record</span>
            </button>
          </nav>
          
          {/* Space for mobile navigation */}
          <div className="h-20"></div>
        </div>
      </div>
    </GoogleDriveProviderWithQueryClient>
  );
}
