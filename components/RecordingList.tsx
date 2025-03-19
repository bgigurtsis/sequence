import React, { useState, useEffect } from 'react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { Recording } from '@/types';
import { Play, Clock, Calendar, Trash2, ChevronDown, ChevronUp, Tag } from 'lucide-react';

interface RecordingListProps {
  rehearsalId: string;
  onSelectRecording: (recording: Recording) => void;
}

export default function RecordingList({ rehearsalId, onSelectRecording }: RecordingListProps) {
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recordingList, setRecordingList] = useState<Recording[]>([]);
  
  const { recordings, deleteRecording } = useGoogleDrive();

  // Load recordings for this rehearsal
  useEffect(() => {
    setRecordingList(recordings[rehearsalId] || []);
    setIsLoading(false);
  }, [rehearsalId, recordings]);

  // Toggle recording expansion
  const toggleRecording = (recordingId: string) => {
    setExpandedRecordingId(expandedRecordingId === recordingId ? null : recordingId);
  };

  // Handle deleting a recording
  const handleDeleteRecording = async (recordingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this recording?')) {
      try {
        await deleteRecording(recordingId, rehearsalId);
      } catch (error) {
        console.error('Error deleting recording:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (recordingList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No recordings yet</p>
        <p className="text-sm mt-2">Record or upload your first video!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recordingList.map((recording) => (
        <div 
          key={recording.id}
          className="bg-white rounded-lg shadow-md overflow-hidden"
        >
          {/* Preview/Thumbnail area */}
          <div 
            className="relative aspect-video bg-gray-100 cursor-pointer"
            onClick={() => onSelectRecording(recording)}
          >
            {recording.thumbnailUrl ? (
              <img 
                src={recording.thumbnailUrl} 
                alt={recording.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <Play size={48} className="text-white opacity-75" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <div className="bg-blue-600 text-white p-2 rounded-full">
                <Play size={24} />
              </div>
            </div>
          </div>
          
          {/* Recording info */}
          <div 
            className="p-4 cursor-pointer"
            onClick={() => toggleRecording(recording.id)}
          >
            <div className="flex justify-between items-start">
              <h3 className="font-medium line-clamp-2">{recording.title}</h3>
              <button 
                onClick={(e) => handleDeleteRecording(recording.id, e)}
                className="text-gray-400 hover:text-red-600 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-y-1 gap-x-3 mt-2 text-xs text-gray-500">
              <div className="flex items-center">
                <Clock size={12} className="mr-1" />
                {recording.time}
              </div>
              <div className="flex items-center">
                <Calendar size={12} className="mr-1" />
                {recording.date}
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-500 truncate max-w-[80%]">
                {recording.performers.join(', ')}
              </div>
              <div>
                {expandedRecordingId === recording.id ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </div>
            </div>
          </div>
          
          {/* Expanded details */}
          {expandedRecordingId === recording.id && (
            <div className="px-4 pb-4 pt-1 border-t border-gray-100">
              {recording.notes && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Notes</h4>
                  <p className="text-sm text-gray-700">{recording.notes}</p>
                </div>
              )}
              
              {recording.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {recording.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                      >
                        <Tag size={10} className="mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 