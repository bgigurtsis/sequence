'use client';

import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function SettingsPage() {
  const { isSignedIn, user } = useUser();
  const { isConnected, isLoading, error, connectGoogleDrive, disconnectGoogleDrive } = useGoogleDrive();
  const [message, setMessage] = useState('');

  const handleConnect = async () => {
    try {
      setMessage('Connecting to Google Drive...');
      await connectGoogleDrive();
      setMessage('Google Drive connected successfully!');
    } catch (error) {
      setMessage(`Error connecting to Google Drive: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      setMessage('Disconnecting from Google Drive...');
      await disconnectGoogleDrive();
      setMessage('Google Drive disconnected successfully!');
    } catch (error) {
      setMessage(`Error disconnecting from Google Drive: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Google Drive Integration</h2>
        
        {isLoading ? (
          <p>Loading Google Drive status...</p>
        ) : (
          <div>
            <div className="mb-4">
              <p>Status: <span className={isConnected ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                {isConnected ? 'Connected' : 'Not Connected'}
              </span></p>
              
              {error && (
                <p className="text-red-500 mt-2">{error}</p>
              )}
            </div>
            
            <div className="flex space-x-4">
              {!isConnected ? (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                  disabled={isLoading || !isSignedIn}
                >
                  Connect Google Drive
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  disabled={isLoading}
                >
                  Disconnect Google Drive
                </button>
              )}
            </div>
            
            {message && (
              <p className="mt-4 text-sm text-gray-700">{message}</p>
            )}
          </div>
        )}
      </div>
      
      {user && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <p>Email: {user.primaryEmailAddress?.emailAddress}</p>
          <p>User ID: {user.id}</p>
        </div>
      )}
    </div>
  );
} 