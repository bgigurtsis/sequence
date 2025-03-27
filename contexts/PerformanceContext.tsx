// contexts/PerformanceContext.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { PerformanceDataProvider, usePerformanceData } from './PerformanceDataContext';
import { UIStateProvider, useUIState } from './UIStateContext';
import { ModalProvider, useModal } from './ModalContext';
import { EditStateProvider, useEditState } from './EditStateContext';

// This is a thin wrapper around the more focused contexts 
// to maintain backward compatibility with existing components
export const PerformanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <PerformanceDataProvider>
      <UIStateProvider>
        <ModalProvider>
          <EditStateProvider>
            {children}
          </EditStateProvider>
        </ModalProvider>
      </UIStateProvider>
    </PerformanceDataProvider>
  );
};

// This hook combines all the other hooks to maintain the same interface
// for existing components during refactoring
export const usePerformances = () => {
  const performanceData = usePerformanceData();
  const uiState = useUIState();
  const modal = useModal();
  const editState = useEditState();

  // Combine all context values into a single object with the same interface
  // as the original usePerformances hook
          return {
    // From PerformanceDataContext
    performances: performanceData.performances,
    collections: performanceData.collections,
    setPerformances: performanceData.setPerformances,
    addPerformance: performanceData.addPerformance,
    updatePerformance: (data: any) => performanceData.updatePerformance(editState.editingPerformance?.id || '', data),
    deletePerformance: performanceData.deletePerformance,
    addRehearsal: (data: any) => performanceData.addRehearsal(uiState.selectedPerformanceId, data),
    updateRehearsal: (data: any) => {
      if (editState.editingRehearsal) {
        performanceData.updateRehearsal(
          editState.editingRehearsal.performanceId, 
          editState.editingRehearsal.rehearsal.id, 
          data
        );
      }
    },
    deleteRehearsal: async () => {
      if (editState.editingRehearsal) {
        await performanceData.deleteRehearsal(
          editState.editingRehearsal.performanceId, 
          editState.editingRehearsal.rehearsal.id
        );
      }
    },
    addRecording: performanceData.addRecording,
    updateRecordingMetadata: (metadata: any) => {
      if (editState.editingRecording) {
        performanceData.updateRecordingMetadata(
          uiState.selectedPerformanceId,
          editState.editingRecording.rehearsalId,
          editState.editingRecording.recording.id,
          metadata
        );
      }
    },
    deleteRecording: async () => {
      if (editState.editingRecording) {
        await performanceData.deleteRecording(
          uiState.selectedPerformanceId,
          editState.editingRecording.rehearsalId,
          editState.editingRecording.recording.id
        );
      }
    },
    handleExternalVideoLink: performanceData.handleExternalVideoLink,
    createCollection: performanceData.createCollection,
    updateCollection: performanceData.updateCollection,
    deleteCollection: performanceData.deleteCollection,
    addToCollection: performanceData.addToCollection,
    removeFromCollection: performanceData.removeFromCollection,
    findPerformanceIdByRehearsalId: performanceData.findPerformanceIdByRehearsalId,
    
    // From UIStateContext
    selectedPerformanceId: uiState.selectedPerformanceId,
    searchQuery: uiState.searchQuery,
    selectedPerformance: uiState.selectedPerformance,
    filteredRecordings: uiState.filteredRecordings,
    todaysRecordings: uiState.todaysRecordings,
    setSelectedPerformanceId: uiState.setSelectedPerformanceId,
    setSearchQuery: uiState.setSearchQuery,
    
    // From ModalContext
    showRecorder: modal.showRecorder,
    showMetadataForm: modal.showMetadataForm,
    showPerformanceForm: modal.showPerformanceForm,
    showRehearsalForm: modal.showRehearsalForm,
    showPreRecordingMetadataForm: modal.showPreRecordingMetadataForm,
    videoToWatch: modal.videoToWatch,
    recordingTargetRehearsalId: modal.recordingTargetRehearsalId,
    setShowRecorder: modal.setShowRecorder,
    setRecordingTargetRehearsalId: modal.setRecordingTargetRehearsalId,
    openRecorder: modal.openRecorder,
    closeRecorder: modal.closeRecorder,
    openPreRecordingMetadata: modal.openPreRecordingMetadata,
    closePreRecordingMetadata: modal.closePreRecordingMetadata,
    openVideoPlayer: modal.openVideoPlayer,
    closeVideoPlayer: modal.closeVideoPlayer,
    
    // From EditStateContext
    editingRecording: editState.editingRecording,
    editingRehearsal: editState.editingRehearsal,
    editingPerformance: editState.editingPerformance,
    preRecordingMetadata: editState.preRecordingMetadata,
    setPreRecordingMetadata: editState.setPreRecordingMetadata,
    handlePreRecordingMetadataSubmit: editState.handlePreRecordingMetadataSubmit,
    
    // Combined operations (require multiple contexts)
    openMetadataForm: (rehearsalId: string, recording: any) => {
      // Call both contexts' functions
      editState.openMetadataForm(rehearsalId, recording);
      modal.openMetadataForm(rehearsalId, recording);
    },
    closeMetadataForm: () => {
      modal.closeMetadataForm();
    },
    openPerformanceForm: (performance?: any) => {
      editState.openPerformanceForm(performance);
      modal.openPerformanceForm();
    },
    closePerformanceForm: () => {
      modal.closePerformanceForm();
    },
    openRehearsalForm: (performanceId: string, rehearsal?: any) => {
      editState.openRehearsalForm(performanceId, rehearsal);
      modal.openRehearsalForm(performanceId);
    },
    closeRehearsalForm: () => {
      modal.closeRehearsalForm();
    },
  };
};