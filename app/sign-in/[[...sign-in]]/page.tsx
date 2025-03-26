'use client';

import { SignIn } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showExpiredMessage, setShowExpiredMessage] = useState(false);
  
  // Check if the user was redirected due to an expired session
  useEffect(() => {
    if (searchParams) {
      const sessionParam = searchParams.get('session');
      if (sessionParam === 'expired') {
        setShowExpiredMessage(true);
        
        // Clear the alert flag to ensure it's not blocked next time
        sessionStorage.removeItem('lastAuthAlert');
      }
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      {showExpiredMessage && (
        <div className="w-full max-w-md mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
          <h2 className="text-lg font-medium mb-2">Session Expired</h2>
          <p>Your session has expired. Please sign in again to continue.</p>
        </div>
      )}
      <div className="w-full max-w-md">
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-md rounded-md"
            }
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/"
        />
      </div>
    </div>
  );
} 