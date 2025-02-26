'use client';

import { useState, useEffect } from 'react';
import { useUser, SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Settings, User } from 'lucide-react';

export default function AuthNav() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // If not signed in with Clerk, check for Google session
    if (isLoaded && !isSignedIn) {
      checkGoogleSession();
    } else {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  async function checkGoogleSession() {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        if (data.userId && data.authProvider === 'google') {
          // Get user details from Google
          const userResponse = await fetch('/api/auth/user');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setGoogleUser(userData);
          }
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center text-sm">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  // Signed in with Clerk
  if (isSignedIn && user) {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          {user.imageUrl && (
            <img 
              src={user.imageUrl} 
              alt={user.fullName || 'User'} 
              className="w-8 h-8 rounded-full mr-2"
            />
          )}
          <span className="text-sm font-medium">{user.fullName || user.primaryEmailAddress?.emailAddress}</span>
        </div>
        <Link href="/settings/google-drive" className="text-sm text-blue-600 hover:text-blue-800">
          <Settings className="h-4 w-4 inline mr-1" />
          Settings
        </Link>
        <SignOutButton>
          <button className="flex items-center text-sm text-red-600 hover:text-red-800">
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </button>
        </SignOutButton>
      </div>
    );
  }

  // Signed in with Google
  if (googleUser) {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          {googleUser.imageUrl && (
            <img 
              src={googleUser.imageUrl} 
              alt={googleUser.name || 'User'} 
              className="w-8 h-8 rounded-full mr-2"
            />
          )}
          <span className="text-sm font-medium">{googleUser.name || googleUser.email}</span>
        </div>
        <Link href="/settings/google-drive" className="text-sm text-blue-600 hover:text-blue-800">
          <Settings className="h-4 w-4 inline mr-1" />
          Settings
        </Link>
        <button 
          onClick={handleGoogleSignOut}
          className="flex items-center text-sm text-red-600 hover:text-red-800"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Sign Out
        </button>
      </div>
    );
  }

  // Not signed in
  return (
    <Link href="/signin" className="flex items-center text-sm text-blue-600 hover:text-blue-800">
      <LogIn className="h-4 w-4 mr-1" />
      Sign In
    </Link>
  );
}
