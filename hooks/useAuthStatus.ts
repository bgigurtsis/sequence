import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

/**
 * Interface for auth status returned by the hook
 */
export interface AuthStatus {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string;
  sessionId?: string;
  googleConnected?: boolean;
  lastChecked: number;
}

/**
 * Custom hook for central authentication state management
 * Replaces various global functions and provides a consistent way to validate auth
 */
export function useAuthStatus() {
  // Use Clerk's useAuth hook for base authentication state
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  
  // Extended state tracking
  const [googleConnected, setGoogleConnected] = useState<boolean | undefined>(undefined);
  const [lastChecked, setLastChecked] = useState<number>(0);
  const [isChecking, setIsChecking] = useState(false);
  
  // Log with timestamp for debugging
  const logWithTimestamp = useCallback((type: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][useAuthStatus][${type}] ${message}`, data ? data : '');
  }, []);
  
  /**
   * Check if Google Drive is connected
   * @returns Promise resolving to boolean indicating if Google Drive is connected
   */
  const checkGoogleDriveStatus = useCallback(async (): Promise<boolean> => {
    if (!isSignedIn) return false;
    
    try {
      const response = await fetch('/api/auth/google-status', {
        method: 'GET',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      if (!response.ok) {
        logWithTimestamp('ERROR', `Failed to check Google status: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      return !!data.connected;
    } catch (error) {
      logWithTimestamp('ERROR', 'Error checking Google Drive status', error);
      return false;
    }
  }, [isSignedIn, logWithTimestamp]);
  
  /**
   * Validate auth status including Google Drive connection if needed
   * @param checkGoogle Whether to check Google Drive connection
   * @returns Promise resolving to true if authentication is valid
   */
  const validateAuth = useCallback(async (checkGoogle = false): Promise<boolean> => {
    if (!isLoaded) return false;
    if (!isSignedIn) return false;
    
    setIsChecking(true);
    const now = Date.now();
    
    try {
      // If Google check is required, validate Google Drive connection
      if (checkGoogle) {
        const isGoogleConnected = await checkGoogleDriveStatus();
        setGoogleConnected(isGoogleConnected);
        setLastChecked(now);
        setIsChecking(false);
        return isSignedIn && isGoogleConnected;
      }
      
      // Otherwise just return the sign-in status
      setLastChecked(now);
      setIsChecking(false);
      return isSignedIn;
    } catch (error) {
      logWithTimestamp('ERROR', 'Error validating auth', error);
      setIsChecking(false);
      return false;
    }
  }, [isLoaded, isSignedIn, checkGoogleDriveStatus, logWithTimestamp]);
  
  // Check Google Drive status once when signed in
  useEffect(() => {
    if (isLoaded && isSignedIn && googleConnected === undefined) {
      checkGoogleDriveStatus().then(connected => {
        setGoogleConnected(connected);
        setLastChecked(Date.now());
      });
    }
  }, [isLoaded, isSignedIn, googleConnected, checkGoogleDriveStatus]);
  
  // Periodic background check every 15 minutes
  useEffect(() => {
    if (!isSignedIn) return;
    
    const checkInterval = 15 * 60 * 1000; // 15 minutes
    const timer = setInterval(() => {
      validateAuth(true).then(isValid => {
        if (!isValid) {
          logWithTimestamp('WARNING', 'Periodic check found invalid auth status');
        }
      });
    }, checkInterval);
    
    return () => clearInterval(timer);
  }, [isSignedIn, validateAuth, logWithTimestamp]);
  
  return {
    authStatus: {
      isLoaded,
      isSignedIn,
      userId,
      sessionId,
      googleConnected,
      lastChecked
    } as AuthStatus,
    isChecking,
    validateAuth
  };
} 