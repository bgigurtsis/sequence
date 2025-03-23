// app/settings/google-drive/page.tsx
'use client';

import React, { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import {
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export default function GoogleDriveSettings() {
  const { user, isSignedIn, isLoaded } = useUser();
  const {
    isConnected,
    isLoading,
    error,
    connectGoogleDrive,
    disconnectGoogleDrive,
    refreshStatus
  } = useGoogleDrive();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSuccess = searchParams?.get('success');
  const urlError = searchParams?.get('error');

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/signin');
    } else if (urlSuccess || urlError) {
      // If we have success/error params, refresh the status
      refreshStatus();
    }
  }, [isLoaded, isSignedIn, router, urlSuccess, urlError]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Checking Google Drive connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Google Drive Settings</h1>

        {urlSuccess === 'connected' && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>Google Drive connected successfully! Your recordings will now be saved to your Google Drive.</p>
          </div>
        )}

        {urlError && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md flex items-start">
            <XCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Failed to connect Google Drive</p>
              <p className="text-sm">
                {urlError === 'access_denied' && 'You denied access to your Google Drive.'}
                {urlError === 'invalid_request' && 'Invalid request. Please try again.'}
                {urlError === 'no_refresh_token' && 'Google did not provide a refresh token. Please try again.'}
                {urlError === 'server_error' && 'Server error. Please try again later.'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mb-6 p-4 bg-blue-50 rounded-md">
          <div className="flex items-start">
            <Info className="h-5 w-5 mr-2 mt-0.5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800">About Google Drive Integration</p>
              <p className="text-sm text-blue-700 mt-1">
                Connect your Google Drive to save your recordings directly to your account.
                This gives you complete ownership of your videos and allows you to manage them
                from any device.
              </p>
            </div>
          </div>
        </div>

        {isConnected ? (
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
              <span className="text-green-700">Connected to Google Drive</span>
            </div>
            <p className="text-gray-600 mb-4">
              Your recordings will be saved to your Google Drive in a folder named "StageVault Recordings".
            </p>
            <button
              onClick={disconnectGoogleDrive}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              disabled={isLoading}
            >
              Disconnect from Google Drive
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
              <span className="text-red-700">Not connected to Google Drive</span>
            </div>
            <p className="text-gray-600 mb-4">
              Connect your Google Drive to save recordings to your own Google Drive storage.
            </p>
            <button
              onClick={connectGoogleDrive}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              disabled={isLoading}
            >
              Connect to Google Drive
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <h3 className="font-medium mb-2">Why connect Google Drive?</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Store recordings in your own Google Drive account</li>
            <li>Access your recordings from any device</li>
            <li>Share recordings with others using Google Drive sharing features</li>
            <li>Your storage limit depends on your Google account plan</li>
          </ul>
        </div>
      </div>
    </div>
  );
}