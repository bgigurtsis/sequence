'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';
import ValidationRegistration from '@/components/ValidationRegistration';
import Navigation from '@/components/Navigation';

export default function ClientProviders({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <ClerkProvider>
      <GoogleDriveProvider>
        <ValidationRegistration />
        <Navigation />
        {children}
      </GoogleDriveProvider>
    </ClerkProvider>
  );
} 