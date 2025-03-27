'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';
import Navigation from '@/components/Navigation';
import AuthenticationGuard from '@/components/AuthenticationGuard';
import { usePathname } from 'next/navigation';

// Define public routes that don't require authentication
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up'];

export default function ClientProviders({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_PATHS.includes(pathname!) || 
                        pathname?.startsWith('/sign-in') || 
                        pathname?.startsWith('/sign-up');

  return (
    <ClerkProvider>
      {isPublicRoute ? (
        // Public routes don't need the AuthenticationGuard
        <>
          <Navigation />
          {children}
        </>
      ) : (
        // Protected routes wrapped with AuthenticationGuard
        <AuthenticationGuard
          loadingComponent={
            <div className="flex flex-col items-center justify-center min-h-screen">
              <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading your session...</p>
            </div>
          }
        >
          <GoogleDriveProvider>
            <Navigation />
            {children}
          </GoogleDriveProvider>
        </AuthenticationGuard>
      )}
    </ClerkProvider>
  );
} 