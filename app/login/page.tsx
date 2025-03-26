'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if there's a session parameter
    const sessionParam = searchParams?.get('session');
    
    // Redirect from /login to /sign-in, preserving the session parameter if present
    if (sessionParam === 'expired') {
      router.replace('/sign-in?session=expired');
    } else {
      router.replace('/sign-in');
    }
  }, [router, searchParams]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-xl font-bold mb-4">Redirecting...</h1>
      <p>Please wait while we redirect you to the sign-in page.</p>
    </div>
  );
} 