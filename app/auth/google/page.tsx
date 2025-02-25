'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GoogleAuthPage() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
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

    fetchAuthUrl();
  }, []);

  async function handleExchangeCode() {
    if (!code) {
      setError('Please enter authorization code');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to exchange code');
      }

      const data = await response.json();
      setRefreshToken(data.refreshToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Google Drive Authentication</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-8">
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">Step 1: Authorize with Google</h2>
          {loading && !authUrl ? (
            <p>Loading authorization URL...</p>
          ) : authUrl ? (
            <>
              <p className="mb-4">Click the button below to authorize this application with your Google account:</p>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Authorize with Google
              </a>
              <p className="mt-2 text-sm text-gray-500">
                This will open a new window. After authorization, you will receive a code to paste below.
              </p>
            </>
          ) : (
            <p>Failed to generate authorization URL.</p>
          )}
        </div>

        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">Step 2: Enter Authorization Code</h2>
          <p className="mb-4">After authorizing, Google will display a code. Copy and paste it here:</p>
          <input
            type="text"
            value={code || ''}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste authorization code here"
            className="w-full p-2 border rounded mb-4"
          />
          <button
            onClick={handleExchangeCode}
            disabled={loading || !code}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300"
          >
            {loading ? 'Processing...' : 'Get Refresh Token'}
          </button>
        </div>

        {refreshToken && (
          <div className="border rounded-lg p-6 bg-green-50">
            <h2 className="text-lg font-semibold mb-4">Success! Refresh Token Obtained</h2>
            <p className="mb-2">Add this refresh token to your .env.local file:</p>
            <div className="bg-gray-100 p-3 rounded-md overflow-x-auto">
              <pre className="text-sm">GOOGLE_REFRESH_TOKEN={refreshToken}</pre>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              This refresh token provides long-term access to your Google Drive. Keep it secure and never share it.
            </p>
          </div>
        )}

        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Click the "Authorize with Google" button and sign in to your Google account.</li>
            <li>Grant the requested permissions to access your Google Drive.</li>
            <li>Copy the authorization code provided by Google.</li>
            <li>Paste the code in the input field in Step 2 and click "Get Refresh Token".</li>
            <li>Copy the refresh token and update your .env.local file.</li>
            <li>Restart your application for the changes to take effect.</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 