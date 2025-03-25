import type { Metadata } from 'next';
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';
import AuthCheck from '@/components/AuthCheck';
import { SyncIndicator } from '@/components/SyncIndicator';
import { registerGlobalValidationFunctions } from '@/lib/sessionUtils';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StageVault',
  description: 'Record and manage your dance rehearsals',
};

// Add navigation with a link to settings
const Navigation = () => {
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <a href="/" className="text-xl font-bold">StageVault</a>
        <div className="flex space-x-4">
          <a href="/" className="hover:underline">Home</a>
          <a href="/settings" className="hover:underline">Settings</a>
          <SignedIn>
            <AuthCheck />
            <SyncIndicator />
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <a href="/sign-in" className="hover:underline">Sign In</a>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
};

// Update the RootLayout component to include navigation
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Register global validation functions for session management
  useEffect(() => {
    if (typeof window !== 'undefined') {
      registerGlobalValidationFunctions();
    }
  }, []);

  return (
    <ClerkProvider>
      <GoogleDriveProvider>
        <html lang="en">
          <body>
            <Navigation />
            <main>
              {children}
            </main>
          </body>
        </html>
      </GoogleDriveProvider>
    </ClerkProvider>
  );
}
