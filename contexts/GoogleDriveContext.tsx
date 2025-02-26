'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface GoogleDriveContextType {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      refreshStatus();
    } else if (isLoaded) {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  const refreshStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/google-status');
      
      if (!response.ok) {
        throw new Error('Failed to check Google Drive connection status');
      }
      
      const data = await response.json();
      setIsConnected(data.connected);
      setError(null);
    } catch (error) {
      console.error('Error checking Google Drive status:', error);
      setError('Failed to check Google Drive connection status');
    } finally {
      setIsLoading(false);
    }
  };

  const connectGoogleDrive = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/google-connect');
      
      if (!response.ok) {
        throw new Error('Failed to start Google Drive connection');
      }
      
      const data = await response.json();
      
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        await refreshStatus();
      }
    } catch (error) {
      console.error('Error connecting to Google Drive:', error);
      setError('Failed to connect to Google Drive');
      setIsLoading(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/google-disconnect', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to disconnect Google Drive');
      }
      
      await refreshStatus();
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      setError('Failed to disconnect Google Drive');
      setIsLoading(false);
    }
  };

  return (
    <GoogleDriveContext.Provider
      value={{
        isConnected,
        isLoading,
        error,
        connectGoogleDrive,
        disconnectGoogleDrive,
        refreshStatus,
      }}
    >
      {children}
    </GoogleDriveContext.Provider>
  );
}

export function useGoogleDrive() {
  const context = useContext(GoogleDriveContext);
  
  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  
  return context;
} 