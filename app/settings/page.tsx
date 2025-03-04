'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export default function SettingsPage() {
  const { user, loading, isGoogleDriveConnected, setIsGoogleDriveConnected } = useAuth();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  const handleConnectGoogleDrive = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const getAuthUrl = httpsCallable(functions, 'getGoogleAuthUrl');
      const result = await getAuthUrl();
      
      // Open the Google OAuth consent screen
      window.location.href = result.data as string;
    } catch (err) {
      console.error('Error connecting to Google Drive:', err);
      setError('Failed to connect to Google Drive. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogleDrive = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const disconnectGoogleDrive = httpsCallable(functions, 'disconnectGoogleDrive');
      await disconnectGoogleDrive();
      
      setIsGoogleDriveConnected(false);
      setIsConnecting(false);
    } catch (err) {
      console.error('Error disconnecting from Google Drive:', err);
      setError('Failed to disconnect from Google Drive. Please try again.');
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
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Google Drive Integration</h2>
        <p className="mb-4">
          Connect your Google Drive account to store your performance recordings securely.
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="flex items-center">
          <div className="mr-4">
            Status: 
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${isGoogleDriveConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {isGoogleDriveConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          
          {isGoogleDriveConnected ? (
            <button
              onClick={handleDisconnectGoogleDrive}
              disabled={isConnecting}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isConnecting ? 'Disconnecting...' : 'Disconnect Google Drive'}
            </button>
          ) : (
            <button
              onClick={handleConnectGoogleDrive}
              disabled={isConnecting}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        {user && (
          <div>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Display Name:</strong> {user.displayName || 'Not set'}</p>
            <p><strong>Account Created:</strong> {user.metadata.creationTime}</p>
          </div>
        )}
      </div>
    </div>
  );
} 