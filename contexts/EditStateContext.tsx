'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Performance, Rehearsal, Recording, Metadata } from '../types';
import { usePerformanceData } from './PerformanceDataContext';
import { useModal } from './ModalContext';
import { useUIState } from './UIStateContext';

interface EditStateContextType {
  // Editing state
  editingRecording: { rehearsalId: string; recording: Recording } | null;
  editingRehearsal: { performanceId: string; rehearsal: Rehearsal } | null;
  editingPerformance: Performance | null;
  preRecordingMetadata: Metadata | null;
  
  // State setters
  setPreRecordingMetadata: (metadata: Metadata | null) => void;
  
  // Edit actions
  openPerformanceForm: (performance?: Performance) => void;
  openRehearsalForm: (performanceId: string, rehearsal?: Rehearsal) => void;
  openMetadataForm: (rehearsalId: string, recording: Recording) => void;
  handlePreRecordingMetadataSubmit: (metadata: Metadata) => void;
}

const EditStateContext = createContext<EditStateContextType | undefined>(undefined);

export const EditStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get necessary functions from other contexts
  const { updatePerformance: updatePerformanceData, updateRehearsal: updateRehearsalData, updateRecordingMetadata: updateRecordingData } = usePerformanceData();
  const { showPerformanceForm, showRehearsalForm, showMetadataForm, closePerformanceForm, closeRehearsalForm, closeMetadataForm, setShowRecorder } = useModal();
  const { selectedPerformanceId } = useUIState();
  
  // Editing state
  const [editingRecording, setEditingRecording] = useState<{ rehearsalId: string; recording: Recording } | null>(null);
  const [editingRehearsal, setEditingRehearsal] = useState<{ performanceId: string; rehearsal: Rehearsal } | null>(null);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);
  const [preRecordingMetadata, setPreRecordingMetadata] = useState<Metadata | null>(null);
  
  // Form opening functions (with editing state)
  const openPerformanceForm = (performance?: Performance) => {
    if (performance) {
      setEditingPerformance(performance);
    } else {
      setEditingPerformance(null);
    }
    // Modal visibility is handled by ModalContext
  };

  const openRehearsalForm = (performanceId: string, rehearsal?: Rehearsal) => {
    if (rehearsal) {
      setEditingRehearsal({ performanceId, rehearsal });
    } else {
      setEditingRehearsal(null);
    }
    // Modal visibility is handled by ModalContext
  };

  const openMetadataForm = (rehearsalId: string, recording: Recording) => {
    setEditingRecording({ rehearsalId, recording });
    // Modal visibility is handled by ModalContext
  };
  
  // Handle pre-recording metadata submission
  const handlePreRecordingMetadataSubmit = (metadata: Metadata) => {
    console.log('Pre-recording metadata submitted:', metadata);

    // Ensure rehearsalId is set
    if (!metadata.rehearsalId) {
      console.error('Missing rehearsalId in metadata');
      return;
    }

    // Set state for recording process
    setPreRecordingMetadata(metadata);
    // Modal state changes are handled by ModalContext through callbacks
    setShowRecorder(true);
  };
  
  return (
    <EditStateContext.Provider
      value={{
        // Editing state
        editingRecording,
        editingRehearsal,
        editingPerformance,
        preRecordingMetadata,
        
        // State setters
        setPreRecordingMetadata,
        
        // Edit actions
        openPerformanceForm,
        openRehearsalForm,
        openMetadataForm,
        handlePreRecordingMetadataSubmit,
      }}
    >
      {children}
    </EditStateContext.Provider>
  );
};

export const useEditState = () => {
  const context = useContext(EditStateContext);
  if (context === undefined) {
    throw new Error('useEditState must be used within an EditStateProvider');
  }
  return context;
}; 