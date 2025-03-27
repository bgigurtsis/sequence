'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Performance, Recording } from '../types';
import { usePerformanceData } from './PerformanceDataContext';

interface UIStateContextType {
  // UI State
  selectedPerformanceId: string;
  searchQuery: string;
  
  // Computed properties
  selectedPerformance: Performance | undefined;
  filteredRecordings: Recording[];
  todaysRecordings: Recording[];
  
  // UI State actions
  setSelectedPerformanceId: (id: string) => void;
  setSearchQuery: (query: string) => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export const UIStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get performance data from data context
  const { performances } = usePerformanceData();
  
  // UI State
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Set initial performance selection
  useEffect(() => {
    if (performances.length > 0 && !selectedPerformanceId) {
      setSelectedPerformanceId(performances[0].id);
    }
  }, [performances, selectedPerformanceId]);
  
  // Computed properties
  const selectedPerformance = useMemo(() => 
    performances.find((p) => p.id === selectedPerformanceId), 
    [performances, selectedPerformanceId]
  );
  
  // Get today's recordings
  const todaysRecordings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const result: Recording[] = [];

    performances.forEach(performance => {
      performance.rehearsals.forEach(rehearsal => {
        if (rehearsal.date === today) {
          rehearsal.recordings.forEach(recording => {
            result.push({
              ...recording,
            });
          });
        }
      });
    });

    return result;
  }, [performances]);

  // Filter recordings based on search query
  const filteredRecordings = useMemo(() => {
    if (!searchQuery.trim() || !selectedPerformance) return [];

    const result: Recording[] = [];
    const query = searchQuery.toLowerCase();

    selectedPerformance.rehearsals.forEach(rehearsal => {
      rehearsal.recordings.forEach(recording => {
        if (
          recording.title.toLowerCase().includes(query) ||
          recording.performers.some(p => p.toLowerCase().includes(query)) ||
          (recording.tags && recording.tags.some(t => t.toLowerCase().includes(query))) ||
          (recording.notes && recording.notes.toLowerCase().includes(query))
        ) {
          result.push({
            ...recording,
          });
        }
      });
    });

    return result;
  }, [selectedPerformance, searchQuery]);
  
  return (
    <UIStateContext.Provider
      value={{
        // UI State
        selectedPerformanceId,
        searchQuery,
        
        // Computed properties
        selectedPerformance,
        filteredRecordings,
        todaysRecordings,
        
        // UI State actions
        setSelectedPerformanceId,
        setSearchQuery,
      }}
    >
      {children}
    </UIStateContext.Provider>
  );
};

export const useUIState = () => {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
}; 