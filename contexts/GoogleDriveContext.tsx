'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useSignIn } from '@clerk/nextjs';

interface GoogleDriveContextType {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  needsReconnect: boolean;
  hasOAuthAccount: boolean;
  connectGoogleDrive: () => Promise<void>;
  reconnectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [hasOAuthAccount, setHasOAuthAccount] = useState(false);

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
      setError(null);

      // Make sure user is authenticated
      if (!isSignedIn) {
        setIsConnected(false);
        setNeedsReconnect(false);
        setHasOAuthAccount(false);
        setError('You must be signed in to use Google Drive');
        setIsLoading(false);
        return;
      }

      console.log('Checking Google Drive status...');
      const response = await fetch('/api/auth/google-status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      console.log('Google status response:', response.status, response.statusText);

      // Handle response status
      if (response.status === 401) {
        setIsConnected(false);
        setNeedsReconnect(false);
        setHasOAuthAccount(false);
        setError('You must be signed in to use Google Drive');
        setIsLoading(false);
        return;
      }

      if (response.status === 404) {
        console.error('API endpoint not found. Check that /api/auth/google-status exists.');
        setIsConnected(false);
        setNeedsReconnect(false);
        setHasOAuthAccount(false);
        setError('API endpoint not found. Contact support.');
        setIsLoading(false);
        return;
      }

      // Get the response text first to check if it's HTML
      const responseText = await response.text();

      // Check if response is HTML before trying to parse as JSON
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
        console.error('Received HTML instead of JSON from google-status endpoint');
        setIsConnected(false);
        setNeedsReconnect(false);
        setHasOAuthAccount(false);
        setError(`Server error: Received HTML instead of JSON. Status: ${response.status}`);
        setIsLoading(false);
        return;
      }

      // Now try to parse the text as JSON
      try {
        const data = JSON.parse(responseText);
        console.log('Google Drive status data:', data);

        // Set OAuth account status based on API response
        setHasOAuthAccount(!!data.hasOAuthAccount);
        
        // Set reconnection status based on API response
        setNeedsReconnect(!!data.needsReconnect);

        if (data.connected) {
          setIsConnected(true);
          setError(null);
        } else {
          setIsConnected(false);
          
          // Customize error message for reconnection scenario
          if (data.needsReconnect) {
            setError('Google Drive connection needs to be refreshed. Please reconnect.');
          } else {
            setError(data.message || 'Not connected to Google Drive');
          }
        }
      } catch (err) {
        console.error('Error parsing response:', err);
        setIsConnected(false);
        setNeedsReconnect(false);
        // Fix the TypeScript error by safely accessing the error message
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to parse response: ${errorMessage}`);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error checking Google Drive status:', err);
      setIsConnected(false);
      setNeedsReconnect(false);
      // Fix the TypeScript error by safely accessing the error message
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to check connection: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const connectGoogleDrive = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is signed in
      if (!isSignedIn) {
        setError('You must be signed in to connect Google Drive');
        setIsLoading(false);
        return;
      }

      // Check if signIn is loaded
      if (!isSignInLoaded || !signIn) {
        setError('Authentication service not ready');
        setIsLoading(false);
        return;
      }

      console.log('Starting Google Drive connection using Clerk OAuth...');
      
      try {
        // Use Clerk's sign-in method to authenticate with Google
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: `${window.location.origin}/auth/callback`,
          redirectUrlComplete: window.location.href
          // Note: Additional scopes like drive.file need to be configured
          // in the Clerk Dashboard under OAuth settings for Google
        });
        
        // The above will redirect the user to Google's OAuth consent screen
        // After authentication, they will be redirected back to the callback URL
      } catch (oauthError) {
        console.error('Error initiating OAuth connection:', oauthError);
        const errorMessage = oauthError instanceof Error ? oauthError.message : String(oauthError);
        setError(`Failed to connect to Google: ${errorMessage}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      setError('Failed to connect Google Drive');
      setIsLoading(false);
    }
  };

  const reconnectGoogleDrive = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is signed in
      if (!isSignedIn) {
        setError('You must be signed in to reconnect Google Drive');
        setIsLoading(false);
        return;
      }

      // Check if signIn is loaded
      if (!isSignInLoaded || !signIn) {
        setError('Authentication service not ready');
        setIsLoading(false);
        return;
      }

      console.log('Starting Google Drive reconnection using Clerk OAuth...');
      
      try {
        // Force a re-authentication with Google
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: `${window.location.origin}/auth/callback`,
          redirectUrlComplete: window.location.href
          // Note: To force consent screen, configure this in the Clerk Dashboard
          // or add appropriate parameters in the OAuth settings
        });
        
        // This will redirect the user to Google's consent screen
      } catch (oauthError) {
        console.error('Error initiating OAuth reconnection:', oauthError);
        const errorMessage = oauthError instanceof Error ? oauthError.message : String(oauthError);
        setError(`Failed to reconnect to Google: ${errorMessage}`);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error reconnecting to Google Drive:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to reconnect: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isSignedIn || !user) {
        setError('You must be signed in to disconnect Google Drive');
        setIsLoading(false);
        return;
      }

      // Find the Google OAuth account to disconnect
      const googleAccount = user.externalAccounts?.find(
        account => account.provider && account.provider.includes('google')
      );

      if (googleAccount) {
        try {
          // Disconnect the account using Clerk's API
          await googleAccount.destroy();
          console.log('Google account disconnected successfully');
        } catch (error) {
          console.error('Error destroying Google account:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setError(`Failed to disconnect: ${errorMessage}`);
          setIsLoading(false);
          return;
        }
      } else {
        console.log('No Google account found to disconnect');
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
        needsReconnect,
        hasOAuthAccount,
        connectGoogleDrive,
        reconnectGoogleDrive,
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