import React, { useState } from 'react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { PlusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Performance, Rehearsal } from '@/types';

export default function SimplePerformanceSelector() {
  const [isCreatingPerformance, setIsCreatingPerformance] = useState(false);
  const [newPerformanceName, setNewPerformanceName] = useState('');
  const [expandedPerformanceIds, setExpandedPerformanceIds] = useState<string[]>([]);
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string | null>(null);

  const {
    performances,
    rehearsals,
    createPerformance,
    createRehearsal,
    isLoading,
    needsGoogleAuth,
    connectToGoogle
  } = useGoogleDrive();

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

      await createRehearsal(newRehearsal.name);

      // Ensure the performance is expanded to show the new rehearsal
      if (!expandedPerformanceIds.includes(performanceId)) {
        setExpandedPerformanceIds(prev => [...prev, performanceId]);
      }
    } catch (error) {
      console.error('Error creating rehearsal:', error);
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
      <div className="w-full p-4 bg-white rounded-lg shadow-md">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Performances</h2>
          <button
            onClick={() => setIsCreatingPerformance(true)}
            className="text-blue-600 hover:text-blue-800"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      </div>

      {/* New Performance Form */}
      {isCreatingPerformance && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-col space-y-2">
            <input
              type="text"
              value={newPerformanceName}
              onChange={(e) => setNewPerformanceName(e.target.value)}
              placeholder="Performance name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCreatePerformance}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreatingPerformance(false);
                  setNewPerformanceName('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performances List */}
      <div className="max-h-96 overflow-y-auto">
        {performances.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No performances yet. Create your first performance!
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {performances.map((performance: Performance) => (
              <li key={performance.id} className="relative">
                {/* Performance Item */}
                <div
                  className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 ${selectedPerformanceId === performance.id ? 'bg-blue-50' : ''
                    }`}
                  onClick={() => togglePerformance(performance.id)}
                >
                  <div className="mr-2">
                    {expandedPerformanceIds.includes(performance.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{performance.title}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateRehearsal(performance.id);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <PlusCircle size={16} />
                  </button>
                </div>

                {/* Rehearsals List */}
                {expandedPerformanceIds.includes(performance.id) && (
                  <ul className="pl-8 bg-gray-50 divide-y divide-gray-100">
                    {rehearsals[performance.id]?.length > 0 ? (
                      rehearsals[performance.id].map((rehearsal: Rehearsal) => (
                        <li key={rehearsal.id}>
                          <a
                            href={`/rehearsal/${rehearsal.id}`}
                            className="block p-3 hover:bg-gray-100"
                          >
                            <div className="text-sm font-medium">{rehearsal.title}</div>
                            <div className="text-xs text-gray-500">
                              {rehearsal.date} • {rehearsal.location}
                            </div>
                          </a>
                        </li>
                      ))
                    ) : (
                      <li className="p-3 text-sm text-gray-500">
                        No rehearsals yet
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 