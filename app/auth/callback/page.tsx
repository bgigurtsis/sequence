'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useEffect } from 'react';

/**
 * This page handles the OAuth callback completion using Clerk's component.
 * It will process the authentication and handle session creation automatically.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    // Add logging to help troubleshoot the callback
    console.log('Processing OAuth callback...');
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <AuthenticateWithRedirectCallback />
    </div>
  );
} 