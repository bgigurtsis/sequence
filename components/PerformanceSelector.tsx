import React, { useState, useRef, useEffect } from 'react';
import { Performance, Recording, Rehearsal } from '../types';
import { 
  Plus, Edit, Play, Video, Clock, Calendar, 
  ChevronDown, ChevronRight, Upload, Camera, Link as LinkIcon,
  List, Grid, MoreVertical
} from 'lucide-react';
import DropdownPortal from './DropdownPortal';

interface PerformanceSelectorProps {
  selectedPerformanceId: string;
  performances: Performance[];
  searchQuery?: string;
  onSelectPerformance: (id: string) => void;
  onWatchRecording: (rehearsalId: string, recording: Recording) => void;
  onEditRehearsal: (rehearsal: Rehearsal) => void;
  onEditPerformance: (performance: Performance) => void;
  onRecordRehearsal: (rehearsalId: string) => void;
  onNewRehearsal?: (performanceId: string) => void;
  onEditRecording?: (rehearsalId: string, recording: Recording) => void;
  onUploadRecording?: (rehearsalId: string) => void;
  onLinkRecording?: (rehearsalId: string) => void;
}

const PerformanceSelector: React.FC<PerformanceSelectorProps> = ({
  selectedPerformanceId,
  performances,
  searchQuery,
  onSelectPerformance,
  onWatchRecording,
  onEditRehearsal,
  onEditPerformance,
  onRecordRehearsal,
  onNewRehearsal,
  onEditRecording,
  onUploadRecording,
  onLinkRecording
}) => {
  // Find the selected performance
  const selectedPerformance = performances.find(p => p.id === selectedPerformanceId);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedRehearsal, setExpandedRehearsal] = useState<{[key: string]: boolean}>({});
  const [showRecordingOptions, setShowRecordingOptions] = useState<string | null>(null);
  const recordingOptionsRef = useRef<HTMLDivElement>(null);
  const [dropdownAnchorRect, setDropdownAnchorRect] = useState<DOMRect | null>(null);

  // Format date function
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [day, month, year] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };
  
  // Mock duration formatter
  const formatDuration = (recording: Recording) => {
    // This would ideally come from the actual recording metadata
    return '2:34';
  };
  
  // Toggle rehearsal expanded state
  const toggleRehearsal = (rehearsalId: string) => {
    setExpandedRehearsal(prev => ({
      ...prev,
      [rehearsalId]: !prev[rehearsalId]
    }));
  };
  
  // Toggle recording options dropdown
  const toggleRecordingOptions = (rehearsalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Save the button's rect for positioning the dropdown
    const buttonRect = e.currentTarget.getBoundingClientRect();
    setDropdownAnchorRect(buttonRect);
    
    // Toggle the dropdown visibility
    setShowRecordingOptions(prev => prev === rehearsalId ? null : rehearsalId);
  };

  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Performance selector tabs */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-2 pt-2 gap-1 min-w-max">
          {performances.map(performance => (
            <button
              key={performance.id}
              className={`px-3 py-2 text-sm rounded-t-lg whitespace-nowrap ${
                selectedPerformanceId === performance.id
                  ? 'bg-blue-50 font-medium text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => onSelectPerformance(performance.id)}
            >
              {performance.title}
            </button>
          ))}
        </div>
      </div>
      
      {selectedPerformance && (
        <div className="p-3">
          <div className="flex justify-between items-center mb-3">
            {/* Performance title & action buttons */}
            <div className="flex items-center">
              <h2 className="font-medium">{selectedPerformance.title}</h2>
              <button
                onClick={() => onEditPerformance(selectedPerformance)}
                className="ml-2 p-1 text-gray-500 rounded-full hover:bg-gray-100"
              >
                <Edit size={14} />
              </button>
            </div>
            
            {/* Add rehearsal button */}
            {onNewRehearsal && (
              <button
                onClick={() => onNewRehearsal(selectedPerformance.id)}
                className="flex items-center text-xs py-1 px-2 bg-blue-500 text-white rounded"
              >
                <Plus size={14} className="mr-1" />
                Add Rehearsal
              </button>
            )}
          </div>
          
          {/* Rehearsals */}
          {selectedPerformance.rehearsals.length > 0 ? (
            <div className="space-y-3">
              {selectedPerformance.rehearsals.map(rehearsal => (
                <div key={rehearsal.id} className="border rounded-lg overflow-hidden bg-white">
                  {/* Rehearsal header */}
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleRehearsal(rehearsal.id)}
                  >
                    <div>
                      <div className="font-medium flex items-center">
                        {expandedRehearsal[rehearsal.id] ? 
                          <ChevronDown size={16} className="mr-1" /> : 
                          <ChevronRight size={16} className="mr-1" />
                        }
                        {rehearsal.title}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center mt-1">
                        <Calendar size={12} className="mr-1" />
                        {formatDate(rehearsal.date)}
                        <span className="mx-1">•</span>
                        <Video size={12} className="mr-1" />
                        {rehearsal.recordings.length} recordings
                      </div>
                    </div>
                    
                    <div className="flex">
                      {/* New recording options button */}
                      <button
                        onClick={(e) => toggleRecordingOptions(rehearsal.id, e)}
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-md text-xs mr-1 flex items-center"
                      >
                        <Plus size={14} className="mr-1" />
                        <span className="hidden sm:inline">Add Recording</span>
                      </button>
                      
                      {/* Edit rehearsal button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRehearsal(rehearsal);
                        }}
                        className="p-1.5 text-gray-500 rounded-full hover:bg-gray-100"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Recordings list (expanded) */}
                  {expandedRehearsal[rehearsal.id] && (
                    <div className="border-t bg-gray-50 p-2">
                      {/* View mode toggle */}
                      {rehearsal.recordings.length > 0 && (
                        <div className="flex justify-end mb-2">
                          <div className="inline-flex rounded border overflow-hidden">
                            <button 
                              className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                              onClick={() => setViewMode('list')}
                            >
                              <List size={14} />
                            </button>
                            <button 
                              className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                              onClick={() => setViewMode('grid')}
                            >
                              <Grid size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {rehearsal.recordings.length > 0 ? (
                        viewMode === 'list' ? (
                          // List view
                          <div className="space-y-2">
                            {rehearsal.recordings.map(recording => (
                              <div
                                key={recording.id}
                                className="bg-white rounded border overflow-hidden shadow-sm hover:shadow transition-shadow"
                              >
                                {/* Main recording row - list view */}
                                <div className="flex p-2"
                                  onClick={() => onWatchRecording(rehearsal.id, recording)}
                                >
                                  {/* Thumbnail */}
                                  <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 mr-3">
                                    {recording.thumbnailUrl ? (
                                      <img
                                        src={recording.thumbnailUrl}
                                        alt={recording.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Video size={24} className="text-gray-400" />
                                      </div>
                                    )}
                                    <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded-sm">
                                      {formatDuration(recording)}
                                    </div>
                                  </div>
                                  
                                  {/* Metadata */}
                                  <div className="flex-grow min-w-0">
                                    <h5 className="font-medium text-gray-900 text-sm truncate">{recording.title}</h5>
                                    <div className="text-xs text-gray-500 flex items-center mt-1">
                                      <Clock size={10} className="mr-1 flex-shrink-0" />
                                      <span>{recording.time || 'No time'}</span>
                                    </div>
                                    
                                    {recording.tags && recording.tags.length > 0 && (
                                      <div className="text-xs text-blue-500 mt-1 truncate">
                                        #{recording.tags[0]}{recording.tags.length > 1 && ` +${recording.tags.length - 1}`}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Edit button */}
                                  <button 
                                    className="p-1.5 text-gray-500 rounded-full hover:bg-gray-100 self-start"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onEditRecording) onEditRecording(rehearsal.id, recording);
                                    }}
                                    aria-label="Edit recording"
                                  >
                                    <Edit size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Grid view
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {rehearsal.recordings.map(recording => (
                              <div 
                                key={recording.id} 
                                className="bg-white rounded border overflow-hidden shadow-sm hover:shadow transition-shadow"
                              >
                                {/* Thumbnail */}
                                <div 
                                  className="relative aspect-video cursor-pointer"
                                  onClick={() => onWatchRecording(rehearsal.id, recording)}
                                >
                                  {recording.thumbnailUrl ? (
                                    <img
                                      src={recording.thumbnailUrl}
                                      alt={recording.title}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                      <Video size={28} className="text-gray-400" />
                                    </div>
                                  )}
                                  
                                  {/* Play button overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 opacity-0 hover:opacity-100 transition-opacity">
                                    <div className="h-12 w-12 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
                                      <Play size={24} className="text-blue-600 ml-1" />
                                    </div>
                                  </div>
                                  
                                  {/* Duration badge */}
                                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black bg-opacity-60 text-white text-xs rounded">
                                    {formatDuration(recording)}
                                  </div>
                                </div>
                                
                                {/* Info */}
                                <div className="p-2">
                                  <div className="flex justify-between items-start">
                                    <h5 className="font-medium text-gray-900 text-sm truncate flex-1">{recording.title}</h5>
                                    <button 
                                      className="p-1 text-gray-500 rounded-full hover:bg-gray-100 ml-1 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onEditRecording) onEditRecording(rehearsal.id, recording);
                                      }}
                                      aria-label="Edit recording"
                                    >
                                      <Edit size={14} />
                                    </button>
                                  </div>
                                  
                                  <div className="text-xs text-gray-500 flex items-center mt-1">
                                    <Clock size={10} className="mr-1 flex-shrink-0" />
                                    <span>{recording.time || 'No time'}</span>
                                  </div>
                                  
                                  {recording.tags && recording.tags.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {recording.tags.slice(0, 2).map((tag, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                          {tag}
                                        </span>
                                      ))}
                                      {recording.tags.length > 2 && (
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                          +{recording.tags.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="text-center py-6 bg-white rounded-lg border">
                          <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <Video size={24} className="text-gray-400" />
                          </div>
                          <p className="text-gray-500">No recordings yet</p>
                          <div className="mt-3 flex justify-center space-x-2">
                            <button
                              onClick={() => onRecordRehearsal(rehearsal.id)}
                              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md flex items-center"
                            >
                              <Camera size={12} className="mr-1" />
                              Record
                            </button>
                            <button
                              onClick={() => onUploadRecording && onUploadRecording(rehearsal.id)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md flex items-center"
                            >
                              <Upload size={12} className="mr-1" />
                              Upload
                            </button>
                            <button
                              onClick={() => onLinkRecording && onLinkRecording(rehearsal.id)}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md flex items-center"
                            >
                              <LinkIcon size={12} className="mr-1" />
                              Link
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border rounded-lg bg-gray-50">
              <p className="text-gray-500">No rehearsals yet</p>
              {onNewRehearsal && (
                <button
                  onClick={() => onNewRehearsal(selectedPerformance.id)}
                  className="mt-2 text-blue-500 underline"
                >
                  Add your first rehearsal
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Replace the dropdown render code */}
      <DropdownPortal 
        isOpen={showRecordingOptions !== null} 
        onClose={() => setShowRecordingOptions(null)}
        anchorRect={dropdownAnchorRect}
      >
        {showRecordingOptions && (
          <div className="min-w-[180px] bg-white rounded-md shadow-lg border overflow-hidden">
            <button
              onClick={() => {
                setShowRecordingOptions(null);
                onRecordRehearsal(showRecordingOptions);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center"
            >
              <Camera size={16} className="mr-2 text-blue-500" />
              Record with Camera
            </button>
            
            <button
              onClick={() => {
                setShowRecordingOptions(null);
                if (onUploadRecording) onUploadRecording(showRecordingOptions);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center"
            >
              <Upload size={16} className="mr-2 text-blue-500" />
              Upload Video File
            </button>
            
            <button
              onClick={() => {
                setShowRecordingOptions(null);
                if (onLinkRecording) onLinkRecording(showRecordingOptions);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center"
            >
              <LinkIcon size={16} className="mr-2 text-blue-500" />
              Add Video Link
            </button>
          </div>
        )}
      </DropdownPortal>
    </div>
  );
};

export default PerformanceSelector; 