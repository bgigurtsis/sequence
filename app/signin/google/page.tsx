'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';

export default function GoogleSignInPage() {
  const router = useRouter();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have a code in the URL (redirected from Google)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Remove the code from the URL to prevent resubmission
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGoogleSignIn(code);
    } else {
      fetchAuthUrl();
    }
  }, []);

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

  async function handleGoogleSignIn(code: string) {
    try {
      setSigningIn(true);
      setError(null);
      
      const response = await fetch('/api/auth/google-signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign in with Google');
      }

      // Successfully signed in, redirect to home page
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setSigningIn(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
            Sign in with Google
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Use your Google account to sign in and access your Google Drive
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {signingIn ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p>Signing you in with Google...</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {loading ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : authUrl ? (
              <div>
                <a
                  href={authUrl}
                  className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <LogIn className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
                  </span>
                  Sign in with Google
                </a>
                <p className="mt-2 text-center text-xs text-gray-500">
                  By signing in, you'll grant this app access to your Google Drive for file storage.
                </p>
              </div>
            ) : (
              <button
                onClick={fetchAuthUrl}
                className="group relative flex w-full justify-center rounded-md bg-gray-300 px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Retry loading sign-in options
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
