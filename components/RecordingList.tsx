import React, { useState, useEffect } from 'react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { Recording } from '@/types';
import { Play, Clock, Calendar, Trash2, ChevronDown, ChevronUp, Tag, Video } from 'lucide-react';

interface RecordingListProps {
  rehearsalId: string;
  onSelectRecording: (recording: Recording) => void;
}

export default function RecordingList({ rehearsalId, onSelectRecording }: RecordingListProps) {
  const [expandedRecordingId, setExpandedRecordingId] = useState<string | null>(null);

  const {
    recordings,
    isLoadingRecordings,
    deleteFile
  } = useGoogleDrive();

  // Toggle recording expansion
  const toggleRecording = (recordingId: string) => {
    setExpandedRecordingId(expandedRecordingId === recordingId ? null : recordingId);
  };

  // Handle recording deletion
  const handleDeleteRecording = async (recordingId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!window.confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
      return;
    }

    try {
      if (deleteFile) {
        await deleteFile(recordingId);
      } else {
        console.error('Delete function is not available');
        alert('Cannot delete recording at this time');
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      alert('Failed to delete recording');
    }
  };

  // Format recording date
  const formatDate = (recording: Recording) => {
    if (!recording.createdAt) return 'Unknown date';

    const date = new Date(recording.createdAt);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format recording title
  const getRecordingTitle = (recording: Recording) => {
    return recording.title || (recording as any).name || 'Untitled Recording';
  };

  if (isLoadingRecordings) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
        Loading recordings...
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No recordings found for this rehearsal.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recordings.map((recording: Recording) => (
        <div
          key={recording.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <div
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => toggleRecording(recording.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <Video className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{getRecordingTitle(recording)}</div>
                <div className="text-xs text-gray-500 flex items-center">
                  <Calendar size={12} className="mr-1" />
                  {formatDate(recording)}
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <button
                className="p-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRecording(recording);
                }}
              >
                <Play size={16} />
              </button>

              <button
                className="p-2 text-red-600 hover:text-red-800 transition-colors"
                onClick={(e) => handleDeleteRecording(recording.id, e)}
              >
                <Trash2 size={16} />
              </button>

              {expandedRecordingId === recording.id ? (
                <ChevronUp size={16} className="text-gray-500" />
              ) : (
                <ChevronDown size={16} className="text-gray-500" />
              )}
            </div>
          </div>

          {expandedRecordingId === recording.id && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              {recording.notes && (
                <div className="mb-2">
                  <div className="text-xs font-medium text-gray-500 mb-1">Notes</div>
                  <p className="text-sm text-gray-700">{recording.notes}</p>
                </div>
              )}

              {recording.performers && recording.performers.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-medium text-gray-500 mb-1">Performers</div>
                  <div className="flex flex-wrap gap-1">
                    {recording.performers?.map((performer: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full"
                      >
                        {performer}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {recording.tags && recording.tags.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {recording.tags?.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full flex items-center"
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