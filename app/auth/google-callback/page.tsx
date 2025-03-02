'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function GoogleCallback() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    // Send the code or error back to the opener window
    if (window.opener) {
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_CALLBACK',
        code,
        error
      }, window.location.origin);
      
      // Close this popup
      window.close();
    } else {
      // If opened directly (not as popup), redirect to settings page
      window.location.href = '/settings?google_auth_status=' + (code ? 'success' : 'error');
    }
  }, [searchParams]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-xl font-bold mb-4">Connecting to Google Drive...</h1>
      <p>Please wait while we complete the connection.</p>
    </div>
  );
} 