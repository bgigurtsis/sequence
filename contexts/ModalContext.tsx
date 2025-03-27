'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Recording } from '../types';

interface ModalContextType {
  // Modal visibility state
  showRecorder: boolean;
  showMetadataForm: boolean;
  showPerformanceForm: boolean;
  showRehearsalForm: boolean;
  showPreRecordingMetadataForm: boolean;
  videoToWatch: { recording: Recording; videoUrl: string } | null;
  recordingTargetRehearsalId: string | null;
  
  // State setters
  setShowRecorder: (show: boolean) => void;
  setRecordingTargetRehearsalId: (id: string | null) => void;
  
  // Modal controls
  openRecorder: () => void;
  closeRecorder: () => void;
  openPreRecordingMetadata: (rehearsalId: string) => void;
  closePreRecordingMetadata: () => void;
  openMetadataForm: (rehearsalId: string, recording: Recording) => void;
  closeMetadataForm: () => void;
  openPerformanceForm: () => void;
  closePerformanceForm: () => void;
  openRehearsalForm: (performanceId: string) => void;
  closeRehearsalForm: () => void;
  openVideoPlayer: (recording: Recording) => void;
  closeVideoPlayer: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Modal visibility state
  const [showRecorder, setShowRecorder] = useState<boolean>(false);
  const [showMetadataForm, setShowMetadataForm] = useState<boolean>(false);
  const [showPerformanceForm, setShowPerformanceForm] = useState<boolean>(false);
  const [showRehearsalForm, setShowRehearsalForm] = useState<boolean>(false);
  const [showPreRecordingMetadataForm, setShowPreRecordingMetadataForm] = useState<boolean>(false);
  const [videoToWatch, setVideoToWatch] = useState<{ recording: Recording; videoUrl: string } | null>(null);
  const [recordingTargetRehearsalId, setRecordingTargetRehearsalId] = useState<string | null>(null);
  
  // Modal control functions
  const openRecorder = () => setShowRecorder(true);
  
  const closeRecorder = () => {
    setShowRecorder(false);
    setRecordingTargetRehearsalId(null);
  };

  const openPreRecordingMetadata = (rehearsalId: string) => {
    setRecordingTargetRehearsalId(rehearsalId);
    setShowPreRecordingMetadataForm(true);
  };

  const closePreRecordingMetadata = () => {
    setShowPreRecordingMetadataForm(false);
    setRecordingTargetRehearsalId(null);
  };

  const openMetadataForm = (rehearsalId: string, recording: Recording) => {
    // We only store the visibility state in this context
    // The editing state is managed in EditStateContext
    setShowMetadataForm(true);
  };

  const closeMetadataForm = () => {
    setShowMetadataForm(false);
  };

  const openPerformanceForm = () => {
    setShowPerformanceForm(true);
  };

  const closePerformanceForm = () => {
    setShowPerformanceForm(false);
  };

  const openRehearsalForm = (performanceId: string) => {
    setShowRehearsalForm(true);
  };

  const closeRehearsalForm = () => {
    setShowRehearsalForm(false);
  };

  const openVideoPlayer = (recording: Recording) => {
    setVideoToWatch({ recording, videoUrl: recording.videoUrl });
  };

  const closeVideoPlayer = () => {
    setVideoToWatch(null);
  };
  
  return (
    <ModalContext.Provider
      value={{
        // Modal visibility state
        showRecorder,
        showMetadataForm,
        showPerformanceForm,
        showRehearsalForm,
        showPreRecordingMetadataForm,
        videoToWatch,
        recordingTargetRehearsalId,
        
        // State setters
        setShowRecorder,
        setRecordingTargetRehearsalId,
        
        // Modal controls
        openRecorder,
        closeRecorder,
        openPreRecordingMetadata,
        closePreRecordingMetadata,
        openMetadataForm,
        closeMetadataForm,
        openPerformanceForm,
        closePerformanceForm,
        openRehearsalForm,
        closeRehearsalForm,
        openVideoPlayer,
        closeVideoPlayer,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}; 