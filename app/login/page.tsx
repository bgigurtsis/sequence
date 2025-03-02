'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect from /login to /sign-in
    router.replace('/sign-in');
  }, [router]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-xl font-bold mb-4">Redirecting...</h1>
      <p>Please wait while we redirect you to the sign-in page.</p>
    </div>
  );
} 