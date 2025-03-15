'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TokenService } from '@/lib/tokenService';

export default function SettingsPage() {
  const { user, loading, isGoogleDriveConnected, setIsGoogleDriveConnected } = useAuth();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  // Generate Google OAuth URL
  const generateAuthUrl = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Generate the auth URL from our API
      const response = await fetch('/api/auth/google-url');
      const data = await response.json();
      
      if (response.ok && data.url) {
        setAuthUrl(data.url);
      } else {
        setError(data.error || 'Failed to generate authorization URL');
      }
    } catch (error) {
      console.error('Error generating auth URL:', error);
      setError('Failed to start Google Drive connection');
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle OAuth code exchange
  const handleExchangeCode = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }
    
    try {
      setIsConnecting(true);
      setError(null);
      
      const response = await fetch('/api/auth/google-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
          code: authCode
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsGoogleDriveConnected(true);
        setAuthUrl(null);
        setAuthCode('');
      } else {
        setError(data.error || 'Failed to connect Google Drive');
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      setError('Failed to connect Google Drive');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Google Drive
  const disconnectGoogleDrive = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Remove token from storage
      if (user) {
        await TokenService.removeToken(user.uid);
      }
      
      setIsGoogleDriveConnected(false);
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      setError('Failed to disconnect Google Drive');
    } finally {
      setIsConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      {/* Google Drive Integration */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Google Drive Integration</h2>
        
        <p className="mb-4">
          Connect your Google Drive account to store your performance recordings securely in the cloud.
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Connection status */}
        <div className="flex items-center mb-6">
          <span className="mr-2">Status:</span>
          {isGoogleDriveConnected ? (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
              Connected
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm">
              Not Connected
            </span>
          )}
        </div>
        
        {/* Connection controls */}
        {isGoogleDriveConnected ? (
          <button
            onClick={disconnectGoogleDrive}
            disabled={isConnecting}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {isConnecting ? 'Disconnecting...' : 'Disconnect Google Drive'}
          </button>
        ) : (
          <div>
            {!authUrl ? (
              <button
                onClick={generateAuthUrl}
                disabled={isConnecting}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2">Step 1: Click the link below to authorize with Google:</p>
                  <a 
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Open Google Authorization
                  </a>
                </div>
                
                <div>
                  <p className="mb-2">Step 2: Enter the authorization code:</p>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    className="border p-2 rounded w-full mb-2"
                    placeholder="Paste authorization code here"
                  />
                  <button
                    onClick={handleExchangeCode}
                    disabled={isConnecting || !authCode}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Complete Connection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Account Information */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        {user && (
          <div className="space-y-2">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Display Name:</strong> {user.displayName || 'Not set'}</p>
            <p><strong>Account Created:</strong> {new Date(user.metadata.creationTime).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
} 