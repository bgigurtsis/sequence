'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

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
  const { isSignedIn, isLoaded } = useUser();
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

      // Start the OAuth flow by getting the authorization URL from your backend
      const response = await fetch('/api/auth/google-auth-url', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get Google auth URL:', errorText);
        setError('Failed to start Google Drive connection');
        setIsLoading(false);
        return;
      }

      const { url } = await response.json();

      // Check that we got a valid URL
      if (!url) {
        console.error('No Google auth URL returned from API');
        setError('Failed to start Google Drive connection');
        setIsLoading(false);
        return;
      }

      // Open Google OAuth consent screen in a popup
      const popup = window.open(url, 'googleAuth', 'width=600,height=700');

      if (!popup) {
        setError('Popup blocked. Please allow popups for this site.');
        setIsLoading(false);
        return;
      }

      // Listen for the OAuth callback
      const messageHandler = async (event: MessageEvent) => {
        // Only process messages from our expected origin
        if (event.origin !== window.location.origin) return;

        // Check if this is our OAuth callback message
        if (event.data && event.data.type === 'GOOGLE_AUTH_CALLBACK') {
          // Remove the event listener since we've received the message
          window.removeEventListener('message', messageHandler);

          const { code, error: authError } = event.data;

          if (authError) {
            setError(`Google authentication failed: ${authError}`);
            setIsLoading(false);
            return;
          }

          if (!code) {
            setError('No authorization code received from Google');
            setIsLoading(false);
            return;
          }

          try {
            // Exchange the code for tokens
            const tokenResponse = await fetch('/api/auth/exchange-code', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ code })
            });

            if (!tokenResponse.ok) {
              const errorData = await tokenResponse.text();
              console.error('Token exchange failed:', errorData);
              setError('Failed to complete Google Drive connection');
              setIsLoading(false);
              return;
            }

            const tokenData = await tokenResponse.json();

            // Check if we need to store the token client-side
            if (tokenData.needsClientStorage && tokenData.token) {
              // Store the token in localStorage
              try {
                const user = await fetch('/api/auth/me', {
                  method: 'GET',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }).then(res => {
                  if (!res.ok) {
                    if (res.status === 401) {
                      console.warn('User not authenticated, cannot initialize Google Drive');
                      return { authenticated: false };
                    }
                    throw new Error(`Error fetching user data: ${res.status}`);
                  }
                  return res.json();
                });
                if (user && user.id) {
                  localStorage.setItem(`google_token_${user.id}`, tokenData.token);
                  console.log('Stored Google token in localStorage due to missing server-side storage');
                }
              } catch (localStorageError) {
                console.error('Failed to store token in localStorage:', localStorageError);
                // Continue anyway, as the connection might still work
              }
            }

            // Connection successful, refresh status
            await refreshStatus();
          } catch (error) {
            console.error('Error connecting Google Drive:', error);
            setError('Failed to connect Google Drive');
            setIsLoading(false);
          }
        }
      };

      // Add event listener for the popup callback
      window.addEventListener('message', messageHandler);

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

      console.log('Starting Google Drive reconnection...');
      
      // Call the reconnection endpoint instead of the regular auth URL endpoint
      const response = await fetch('/api/auth/google-reconnect', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get Google reconnect URL:', errorText);
        setError('Failed to start Google Drive reconnection');
        setIsLoading(false);
        return;
      }

      const { url } = await response.json();

      // Check that we got a valid URL
      if (!url) {
        console.error('No Google reconnect URL returned from API');
        setError('Failed to start Google Drive reconnection');
        setIsLoading(false);
        return;
      }

      // Open the Google auth page in the current window
      window.location.href = url;
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

      const response = await fetch('/api/auth/google-disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
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