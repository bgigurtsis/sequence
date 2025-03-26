'use client';

import Link from 'next/link';
import { SignInButton, SignOutButton, UserButton, useUser } from '@clerk/nextjs';

export default function AuthNav() {
  const { isSignedIn, isLoaded } = useUser();

  // Don't render anything while Clerk is loading
  if (!isLoaded) {
    return null; // Or a minimal loading indicator
  }

  return (
    <div className="flex items-center space-x-4">
      {isSignedIn ? (
        // User is authenticated, show user button and sign out button
        <div className="flex items-center space-x-4">
          <UserButton afterSignOutUrl="/" />
          <SignOutButton>
            <button className="text-sm text-gray-700 hover:text-gray-900">
              Sign out
            </button>
          </SignOutButton>
        </div>
      ) : (
        // User is not authenticated, show sign in button
        <SignInButton mode="modal">
          <button className="text-sm text-gray-700 hover:text-gray-900">
            Sign in
          </button>
        </SignInButton>
      )}
    </div>
  );
}
