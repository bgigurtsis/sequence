import React, { useState, useRef, useEffect } from 'react';
import { Recording, Rehearsal, Performance } from '../types';
import {
  Plus, Edit, Play, Video, Clock, Calendar,
  ChevronDown, ChevronRight, Upload, Camera, Link as LinkIcon,
  List, Grid, MoreVertical, PlusCircle
} from 'lucide-react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';

interface PerformanceSelectorProps {
  onWatchRecording: (rehearsalId: string, recording: Recording) => void;
  onSelectRehearsal?: (rehearsal: Rehearsal) => void;
}

const PerformanceSelector: React.FC<PerformanceSelectorProps> = ({
  onWatchRecording,
  onSelectRehearsal
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedRehearsal, setExpandedRehearsal] = useState<{ [key: string]: boolean }>({});
  const [showRecordingOptions, setShowRecordingOptions] = useState<string | null>(null);
  const recordingOptionsRef = useRef<HTMLDivElement>(null);
  const [dropdownAnchorRect, setDropdownAnchorRect] = useState<DOMRect | null>(null);
  const [isCreatingPerformance, setIsCreatingPerformance] = useState(false);
  const [newPerformanceName, setNewPerformanceName] = useState('');
  const [expandedPerformanceIds, setExpandedPerformanceIds] = useState<string[]>([]);
  const [isCreatingRehearsal, setIsCreatingRehearsal] = useState(false);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null);

  const {
    performances,
    rehearsals,
    recordings,
    createPerformance,
    createRehearsal,
    isLoading,
    needsGoogleAuth,
    connectToGoogle,
    getRecordingUrl
  } = useGoogleDrive();

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

    // Find the rehearsal and call onSelectRehearsal if provided
    if (onSelectRehearsal && selectedPerformanceId) {
      const rehearsalList = rehearsals[selectedPerformanceId] || [];
      const rehearsal = rehearsalList.find((r: Rehearsal) => r.id === rehearsalId);
      if (rehearsal) {
        onSelectRehearsal(rehearsal);
      }
    }
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

  // Toggle performance expansion
  const togglePerformance = (performanceId: string) => {
    setExpandedPerformanceIds(prev =>
      prev.includes(performanceId)
        ? prev.filter(id => id !== performanceId)
        : [...prev, performanceId]
    );
    setSelectedPerformanceId(performanceId);
  };

  // Handle creating a new performance
  const handleCreatePerformance = async () => {
    if (!newPerformanceName.trim()) return;

    try {
      await createPerformance(newPerformanceName);
      setNewPerformanceName('');
      setIsCreatingPerformance(false);
    } catch (error) {
      console.error('Error creating performance:', error);
    }
  };

  // Handle creating a new rehearsal
  const handleCreateRehearsal = async (performanceId: string) => {
    if (!performanceId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const newRehearsal = {
        name: `Rehearsal ${new Date().toLocaleDateString()}`,
        location: 'Studio',
        date: today
      };

      await createRehearsal(
        newRehearsal.name
      );

      // Ensure the performance is expanded to show the new rehearsal
      if (!expandedPerformanceIds.includes(performanceId)) {
        setExpandedPerformanceIds(prev => [...prev, performanceId]);
      }
    } catch (error) {
      console.error('Error creating rehearsal:', error);
    }
  };

  // Handle watching a recording
  const handleWatchRecording = async (rehearsalId: string, recording: Recording) => {
    try {
      const videoUrl = await getRecordingUrl(recording.id);
      onWatchRecording(rehearsalId, { ...recording, videoUrl });
    } catch (error) {
      console.error('Error getting video URL:', error);
    }
  };

  // If Google auth is needed, show connect button
  if (needsGoogleAuth) {
    return (
      <div className="w-full p-4 bg-white rounded-lg shadow-md">
        <div className="text-center p-4">
          <h2 className="text-xl font-semibold mb-4">Connect Google Drive</h2>
          <p className="mb-4">Connect your Google Drive account to store and access your recordings.</p>
          <button
            onClick={connectToGoogle}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Connect Google Drive
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasRehearsals = performances.some((p: Performance) => p.rehearsals.some((r: Rehearsal) => true));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
          >
            <Grid size={18} />
          </button>
        </div>
        <button
          onClick={() => setIsCreatingPerformance(true)}
          className="text-blue-600 flex items-center text-sm"
        >
          <PlusCircle size={16} className="mr-1" />
          New Performance
        </button>
      </div>

      {isCreatingPerformance ? (
        <div className="bg-white p-4 rounded-lg shadow-md mb-4">
          <h3 className="font-medium mb-2">Create New Performance</h3>
          <div className="flex items-center">
            <input
              type="text"
              value={newPerformanceName}
              onChange={(e) => setNewPerformanceName(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2 mr-2"
              placeholder="Performance name"
            />
            <button
              onClick={handleCreatePerformance}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {performances.map((performance: Performance) => (
          <div key={performance.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer"
              onClick={() => togglePerformance(performance.id)}
            >
              <div className="flex items-center">
                {expandedPerformanceIds.includes(performance.id) ? (
                  <ChevronDown size={20} className="text-gray-500 mr-2" />
                ) : (
                  <ChevronRight size={20} className="text-gray-500 mr-2" />
                )}
                <h3 className="font-medium">{performance.title}</h3>
              </div>
            </div>

            {expandedPerformanceIds.includes(performance.id) && (
              <div className="pl-10 pr-4 pb-4 space-y-2">
                {/* List rehearsals for this performance */}
                {rehearsals[performance.id]?.length > 0 ? (
                  rehearsals[performance.id].map((rehearsal: Rehearsal) => (
                    <div key={rehearsal.id} className="border rounded-md overflow-hidden">
                      <div
                        className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer"
                        onClick={() => toggleRehearsal(rehearsal.id)}
                      >
                        <div className="flex items-center">
                          {expandedRehearsal[rehearsal.id] ? (
                            <ChevronDown size={16} className="text-gray-500 mr-2" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-500 mr-2" />
                          )}
                          <span>{rehearsal.title}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar size={14} className="mr-1" />
                          <span>{rehearsal.date}</span>
                        </div>
                      </div>

                      {expandedRehearsal[rehearsal.id] && (
                        <div className="p-3">
                          {Array.isArray(rehearsal.recordings) && rehearsal.recordings.length > 0 ? (
                            <div className="space-y-2">
                              {rehearsal.recordings.map((recording: Recording) => (
                                <div
                                  key={recording.id}
                                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                  onClick={() => handleWatchRecording(rehearsal.id, recording)}
                                >
                                  <div className="flex items-center">
                                    <Play size={16} className="text-blue-600 mr-2" />
                                    <span>{recording.title}</span>
                                  </div>
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Clock size={12} className="mr-1" />
                                    <span>{formatDuration(recording)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No recordings yet</p>
                          )}

                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecordingOptions(rehearsal.id, e);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-600"
                            >
                              <PlusCircle size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No rehearsals yet</p>
                )}

                <button
                  onClick={() => handleCreateRehearsal(performance.id)}
                  className="text-sm text-blue-600 flex items-center mt-2"
                >
                  <Plus size={14} className="mr-1" />
                  Add Rehearsal
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceSelector;