// components/TodaysRecordings.tsx
'use client';

import React from 'react';
import { Clock, User, Tag, Play } from 'lucide-react';
import { usePerformances } from '../contexts/PerformanceContext';
import { Recording } from '../types';

const TodaysRecordings: React.FC = () => {
  const { todaysRecordings, openVideoPlayer } = usePerformances();
  
  if (todaysRecordings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center mb-6">
        <h2 className="text-lg font-semibold mb-2">Today's Recordings</h2>
        <div className="p-4 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Clock size={20} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No recordings yet today</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Today's Recordings</h2>
        <p className="text-sm text-gray-500">{todaysRecordings.length} recordings today</p>
      </div>
      
      <div className="divide-y">
        {todaysRecordings.map(recording => (
          <RecordingItem 
            key={recording.id} 
            recording={recording} 
            onPlay={() => openVideoPlayer(recording)} 
          />
        ))}
      </div>
    </div>
  );
};

interface RecordingItemProps {
  recording: Recording;
  onPlay: () => void;
}

const RecordingItem: React.FC<RecordingItemProps> = ({ recording, onPlay }) => {
  return (
    <div className="p-3 hover:bg-gray-50">
      <div className="flex items-center">
        {/* Thumbnail */}
        <div 
          className="w-20 h-14 bg-gray-200 rounded overflow-hidden mr-3 flex-shrink-0 relative"
          style={{
            backgroundImage: `url(${recording.thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 opacity-0 hover:opacity-100 transition-opacity"
            onClick={onPlay}
          >
            <Play size={24} className="text-white" />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0" onClick={onPlay}>
          <h3 className="font-medium text-base truncate">{recording.title}</h3>
          
          <div className="flex flex-wrap text-xs text-gray-500 mt-1">
            <div className="flex items-center mr-3">
              <Clock size={12} className="mr-1" />
              <span>{recording.time}</span>
            </div>
            
            {recording.performers.length > 0 && (
              <div className="flex items-center mr-3">
                <User size={12} className="mr-1" />
                <span className="truncate max-w-[100px]">
                  {recording.performers.join(', ')}
                </span>
              </div>
            )}
            
            {recording.tags && recording.tags.length > 0 && (
              <div className="flex items-center">
                <Tag size={12} className="mr-1" />
                <span className="truncate max-w-[100px]">
                  {recording.tags.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Play button */}
        <button 
          onClick={onPlay}
          className="ml-2 p-2 text-blue-500 hover:bg-blue-50 rounded-full"
          aria-label="Play recording"
        >
          <Play size={18} />
        </button>
      </div>
    </div>
  );
};

export default TodaysRecordings;