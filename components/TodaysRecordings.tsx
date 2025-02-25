// components/TodaysRecordings.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Clock, User, Tag, Play, Video, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { usePerformances } from '../contexts/PerformanceContext';
import { Recording } from '../types';

interface ExpandedState {
  [key: string]: boolean;
}

const TodaysRecordings: React.FC = () => {
  const { performances, openVideoPlayer, openMetadataForm } = usePerformances();
  const [todaysRecordings, setTodaysRecordings] = useState<Recording[]>([]);
  const [expandedState, setExpandedState] = useState<ExpandedState>({});
  
  useEffect(() => {
    // Extract all recordings from all performances
    console.log('Gathering today\'s recordings');
    const allRecordings: Recording[] = [];
    
    performances.forEach(performance => {
      performance.rehearsals.forEach(rehearsal => {
        if (rehearsal.recordings && rehearsal.recordings.length > 0) {
          console.log(`Found ${rehearsal.recordings.length} recordings in rehearsal: ${rehearsal.title}`);
          rehearsal.recordings.forEach(recording => {
            // Check if the recording is from today
            if (recording.date === getTodayFormatted()) {
              allRecordings.push(recording);
            }
          });
        }
      });
    });
    
    setTodaysRecordings(allRecordings);
  }, [performances]);
  
  function getTodayFormatted() {
    const today = new Date();
    const dd = today.getDate().toString().padStart(2, '0');
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  
  // Find rehearsal ID for a recording
  const findRehearsalIdForRecording = (recordingId: string): string | null => {
    for (const performance of performances) {
      for (const rehearsal of performance.rehearsals) {
        const recording = rehearsal.recordings.find(r => r.id === recordingId);
        if (recording) {
          return rehearsal.id;
        }
      }
    }
    return null;
  };
  
  const getRecordingCountText = (count: number): string => {
    return `${count} recording${count === 1 ? '' : 's'}`;
  };
  
  // Group recordings by rehearsal
  const recordingsByRehearsal = todaysRecordings.reduce((acc, recording) => {
    const key = `${recording.rehearsalId}-${recording.rehearsalTitle}`;
    if (!acc[key]) {
      acc[key] = {
        rehearsalId: recording.rehearsalId,
        rehearsalTitle: recording.rehearsalTitle || 'Unknown Rehearsal',
        performanceTitle: recording.performanceTitle || 'Unknown Performance',
        recordings: []
      };
    }
    acc[key].recordings.push(recording);
    return acc;
  }, {} as Record<string, { rehearsalId: string, rehearsalTitle: string, performanceTitle: string, recordings: Recording[] }>);
  
  const toggleExpand = (id: string) => {
    setExpandedState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  if (todaysRecordings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Today's Recordings</h2>
          <div className="text-sm text-gray-500">
            {getRecordingCountText(todaysRecordings.length)}
          </div>
        </div>
        <div className="p-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Clock size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500">No recordings today</p>
          <p className="text-xs text-gray-400 mt-1">Record something to see it here</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <h2 className="text-xl font-semibold mb-2">Today's Recordings</h2>
      <p className="text-sm text-gray-500 mb-4">{todaysRecordings.length} recording{todaysRecordings.length !== 1 ? 's' : ''}</p>
      
      <div className="space-y-2">
        {todaysRecordings.map(recording => (
          <div 
            key={recording.id}
            className="border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow"
          >
            <div className="flex p-2 cursor-pointer" onClick={() => openVideoPlayer(recording)}>
              {/* Thumbnail */}
              <div className="relative w-16 h-16 flex-shrink-0 bg-gray-100 mr-3">
                {recording.thumbnailUrl ? (
                  <img
                    src={recording.thumbnailUrl}
                    alt={recording.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video size={20} className="text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Metadata */}
              <div className="flex-grow min-w-0">
                <h5 className="font-medium text-gray-900 text-sm truncate">{recording.title}</h5>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  <Clock size={10} className="mr-1 flex-shrink-0" />
                  <span>{recording.time || 'No time'}</span>
                </div>
              </div>
              
              {/* Edit button */}
              <button 
                className="p-1.5 text-gray-500 rounded-full hover:bg-gray-100 self-start"
                onClick={(e) => {
                  e.stopPropagation();
                  const rehearsalId = findRehearsalIdForRecording(recording.id);
                  if (rehearsalId) {
                    openMetadataForm(rehearsalId, recording);
                  }
                }}
              >
                <Edit size={14} />
              </button>
            </div>
          </div>
        ))}
        
        {todaysRecordings.length === 0 && (
          <div className="text-center py-6 text-gray-500 border rounded-lg bg-gray-50">
            <p>No recordings today</p>
            <p className="text-sm mt-1">Record something to see it here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysRecordings;