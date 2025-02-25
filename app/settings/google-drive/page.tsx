'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

export default function GoogleDriveSettings() {
  const { user, isLoaded, isSignedIn } = useUser();
  const userId = user?.id;
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);

  // Get the auth URL when component loads
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchAuthUrl();
      checkConnection();
    }
  }, [isLoaded, isSignedIn]);

  async function fetchAuthUrl() {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/google-url');
      if (!response.ok) {
        throw new Error(`Failed to get auth URL: ${response.statusText}`);
      }
      const data = await response.json();
      setAuthUrl(data.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function checkConnection() {
    try {
      setLoading(true);
      const response = await fetch(`/api/ping?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setConnected(true);
        setConnectionDetails(data.details);
      } else {
        setConnected(false);
      }
    } catch (err) {
      console.error('Failed to check Google Drive connection:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      setError(null);
      
      const response = await fetch('/api/auth/disconnect', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Google Drive');
      }
      
      setSuccess('Successfully disconnected your Google Drive account');
      setConnected(false);
      setConnectionDetails(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleAuthCallback(code: string) {
    try {
      setConnecting(true);
      setError(null);
      
      const response = await fetch('/api/auth/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Google Drive');
      }

      setSuccess('Successfully connected your Google Drive account!');
      setConnected(true);
      
      // Refresh connection details
      await checkConnection();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  // Handle authorization code from URL when redirected back from Google
  useEffect(() => {
    if (typeof window !== 'undefined' && !connecting && !success) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // Remove the code from the URL to prevent resubmission
        window.history.replaceState({}, document.title, window.location.pathname);
        handleAuthCallback(code);
      }
    }
  }, [connecting, success]);

  // Handle case when user is not logged in
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6">Google Drive Settings</h1>
        <p>Please sign in to access your Google Drive settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Google Drive Settings</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Google Drive Connection Status</h2>
        
        {loading ? (
          <p>Checking connection status...</p>
        ) : connected ? (
          <div>
            <div className="flex items-center text-green-600 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Connected to Google Drive</span>
            </div>
            
            {connectionDetails && (
              <div className="bg-gray-50 p-4 rounded mb-4">
                <h3 className="text-sm font-medium mb-2">Account Details:</h3>
                <p className="text-sm">{connectionDetails.user?.displayName || 'Unknown user'}</p>
                <p className="text-sm">{connectionDetails.user?.emailAddress || ''}</p>
              </div>
            )}
            
            <p className="text-sm text-gray-600 mb-4">
              Your recordings will be automatically synced to your Google Drive account.
            </p>
            
            <button 
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center text-red-600 mb-4">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Not connected to Google Drive</span>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Connect your Google Drive account to automatically sync your recordings.
            </p>
            
            {authUrl ? (
              <a
                href={authUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm6.369 13.119H13.85v4.5h-3.7v-4.5H5.631v-3.089h4.519V5.531h3.7v4.5h4.519v3.088z" />
                </svg>
                Connect Google Drive
              </a>
            ) : (
              <button 
                disabled
                className="px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed"
              >
                Loading...
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">About Google Drive Sync</h2>
        <div className="prose">
          <p>
            When you connect your Google Drive, your recordings will be automatically synced 
            to a folder in your Google Drive account.
          </p>
          
          <h3 className="text-lg font-medium mt-4 mb-2">What gets synced?</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Video recordings</li>
            <li>Recording metadata (title, date, etc.)</li>
            <li>Thumbnails</li>
          </ul>
          
          <h3 className="text-lg font-medium mt-4 mb-2">Privacy</h3>
          <p>
            We only request access to files created by this application. We cannot see or 
            modify any of your existing Google Drive files.
          </p>
        </div>
      </div>
    </div>
  );
} 