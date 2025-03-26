'use client';

import { useAuth } from "@clerk/nextjs";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthenticationGuardProps {
  children: ReactNode;
  loadingComponent?: ReactNode;
  unauthenticatedRedirectPath?: string;
}

export default function AuthenticationGuard({
  children,
  loadingComponent = <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>,
  unauthenticatedRedirectPath = "/sign-in"
}: AuthenticationGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  // Handle redirection if not authenticated
  useEffect(() => {
    // Only redirect after Clerk has fully loaded AND user is not signed in
    if (isLoaded && !isSignedIn) {
      router.push(unauthenticatedRedirectPath);
    }
  }, [isLoaded, isSignedIn, router, unauthenticatedRedirectPath]);

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return <>{loadingComponent}</>;
  }

  // Only show content when Clerk has loaded AND user is signed in
  // The useEffect will handle redirection if not signed in
  if (!isSignedIn) {
    return <>{loadingComponent}</>; // Continue showing loading until redirect happens
  }

  // User is authenticated and Clerk is fully loaded
  return <>{children}</>;
} 