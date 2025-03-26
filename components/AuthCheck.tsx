'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

// Add log levels to control output
function logWithTimestamp(type: string, message: string, data?: any) {
    // Only log in development or for errors/warnings
    const isProd = process.env.NODE_ENV === 'production';
    const logLevel = type === 'ERROR' ? 'error' : 
                    type === 'WARNING' ? 'warn' : 'info';
    
    // Skip non-essential logs in production
    if (isProd && logLevel === 'info' && !message.includes('error') && !message.includes('fail')) {
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    // Simplify data in production
    let logData = data;
    if (isProd && data) {
        if (typeof data === 'object' && data !== null) {
            // Only keep essential fields
            const essentialKeys = ['success', 'error', 'status', 'userId', 'sessionId'];
            const simplifiedData: Record<string, any> = {};
            
            for (const key of essentialKeys) {
                if (key in data) {
                    simplifiedData[key] = data[key];
                }
            }
            
            logData = Object.keys(simplifiedData).length > 0 ? simplifiedData : null;
        }
    }
    
    if (logLevel === 'error') {
        console.error(`[${timestamp}][AuthCheck][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    } else if (logLevel === 'warn') {
        console.warn(`[${timestamp}][AuthCheck][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    } else {
        console.log(`[${timestamp}][AuthCheck][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    }
}

// Enhanced authentication state check including Google OAuth token validity
async function checkAllTokens(): Promise<{
    sessionValid: boolean;
    googleValid: boolean;
    error?: string;
}> {
    const checkId = Math.random().toString(36).substring(2, 8); // Generate a unique ID for this check
    
    console.log(`[AuthCheck:checkAllTokens][${checkId}] Starting token validation check`);
    
    try {
        // First check if Clerk session is valid
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Step 1: Checking Clerk session`);
        const sessionStartTime = Date.now();
        
        const sessionResponse = await fetch('/api/auth/refresh-session', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Session response status: ${sessionResponse.status} (took ${Date.now() - sessionStartTime}ms)`);
        
        // Parse session response
        const sessionData = await sessionResponse.json().catch((err) => {
            console.error(`[AuthCheck:checkAllTokens][${checkId}] Error parsing session response:`, err);
            return { 
                success: false, 
                message: 'Could not parse response' 
            };
        });
        
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Session data:`, {
            success: sessionData.success,
            userId: sessionData.userId ? sessionData.userId.substring(0, 5) + '...' : undefined,
            message: sessionData.message
        });
        
        // If session is invalid, don't bother checking Google
        if (!sessionResponse.ok || !sessionData.success) {
            const errorMsg = `Session invalid: ${sessionData.message || sessionResponse.statusText}`;
            console.error(`[AuthCheck:checkAllTokens][${checkId}] ${errorMsg}`);
            
            return {
                sessionValid: false,
                googleValid: false,
                error: errorMsg
            };
        }
        
        // Session is valid, now check Google token
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Step 2: Checking Google token`);
        const googleStartTime = Date.now();
        
        const googleResponse = await fetch('/api/auth/google-status', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Google response status: ${googleResponse.status} (took ${Date.now() - googleStartTime}ms)`);
        
        // Parse Google response
        const googleData = await googleResponse.json().catch((err) => {
            console.error(`[AuthCheck:checkAllTokens][${checkId}] Error parsing Google response:`, err);
            return { 
                connected: false,
                message: 'Could not parse response' 
            };
        });
        
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Google data:`, {
            connected: googleData.connected,
            authenticated: googleData.authenticated,
            session: googleData.session,
            message: googleData.message,
            code: googleData.code
        });
        
        const result = {
            sessionValid: true,
            googleValid: googleResponse.ok && googleData.connected === true,
            error: !googleResponse.ok ? `Google token invalid: ${googleData.message || googleResponse.statusText}` : undefined
        };
        
        console.log(`[AuthCheck:checkAllTokens][${checkId}] Final result:`, result);
        return result;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[AuthCheck:checkAllTokens][${checkId}] Error during token check:`, {
            message: errorMsg,
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        
        return {
            sessionValid: false,
            googleValid: false,
            error: `Error checking tokens: ${errorMsg}`
        };
    }
}

// Function to refresh all tokens (session and Google)
async function refreshAllTokens(enforceGoogleCheck = false): Promise<boolean> {
    const refreshId = Math.random().toString(36).substring(2, 8); // Generate a unique ID for this refresh
    
    console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Starting refresh with enforceGoogleCheck=${enforceGoogleCheck}`);
    
    try {
        // Step 1: Refresh Clerk session
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Step 1: Refreshing Clerk session`);
        const startTime = Date.now();
        
        const sessionResponse = await fetch('/api/auth/refresh-session', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Session refresh response status: ${sessionResponse.status} (took ${Date.now() - startTime}ms)`);
        
        const sessionData = await sessionResponse.json().catch((err) => {
            console.error(`[AuthCheck:refreshAllTokens][${refreshId}] Error parsing session response:`, err);
            return {};
        });
        
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Session data:`, {
            success: sessionData.success,
            userId: sessionData.userId ? sessionData.userId.substring(0, 5) + '...' : undefined,
            message: sessionData.message
        });
        
        if (!sessionResponse.ok || !sessionData.success) {
            logWithTimestamp('ERROR', `[${refreshId}] Failed to refresh session`, { 
                status: sessionResponse.status,
                message: sessionData.message || 'Unknown error'
            });
            return false;
        }
        
        // Only enforce Google check if explicitly requested
        if (!enforceGoogleCheck) {
            console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Google check not enforced, returning success=true`);
            return true;
        }
        
        // Step 2: Check Google token - just to make sure it's valid
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Step 2: Checking Google token`);
        const googleStartTime = Date.now();
        
        const googleResponse = await fetch('/api/auth/google-status', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Google status response: ${googleResponse.status} (took ${Date.now() - googleStartTime}ms)`);
        
        const googleData = await googleResponse.json().catch((err) => {
            console.error(`[AuthCheck:refreshAllTokens][${refreshId}] Error parsing Google response:`, err);
            return {};
        });
        
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] Google data:`, {
            connected: googleData.connected,
            authenticated: googleData.authenticated,
            session: googleData.session,
            message: googleData.message,
            code: googleData.code
        });
        
        if (!googleResponse.ok || !googleData.connected) {
            logWithTimestamp('ERROR', `[${refreshId}] Google token invalid after refresh`, {
                status: googleResponse.status,
                connected: googleData.connected,
                message: googleData.message || 'Unknown error',
                code: googleData.code
            });
            return false;
        }
        
        // All tokens refreshed and valid
        console.log(`[AuthCheck:refreshAllTokens][${refreshId}] All tokens refreshed and valid`);
        return true;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[AuthCheck:refreshAllTokens][${refreshId}] Error refreshing tokens:`, {
            message: errorMsg,
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        
        logWithTimestamp('ERROR', `[${refreshId}] Error refreshing tokens`, error);
        return false;
    }
}

// Extend Window interface to include our global functions
declare global {
  interface Window {
    refreshBeforeCriticalOperation?: (enforceGoogleCheck?: boolean) => Promise<boolean>;
    validateAllTokensForRecording?: () => Promise<boolean>;
    refreshSessionBeforeAction?: () => Promise<void>;
  }
}

// Create and export the AuthCheck component
export function AuthCheck() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Make the refresh and validation functions available globally
    if (typeof window !== 'undefined') {
      window.refreshBeforeCriticalOperation = refreshAllTokens;
      window.validateAllTokensForRecording = async () => {
        const result = await checkAllTokens();
        return result.sessionValid && result.googleValid;
      };
      window.refreshSessionBeforeAction = async () => {
        setIsChecking(true);
        try {
          await refreshAllTokens(true);
        } catch (error) {
          console.error('Error refreshing session:', error);
        } finally {
          setIsChecking(false);
        }
      };
    }

    return () => {
      // Clean up global functions when component unmounts
      if (typeof window !== 'undefined') {
        window.refreshBeforeCriticalOperation = undefined;
        window.validateAllTokensForRecording = undefined;
        window.refreshSessionBeforeAction = undefined;
      }
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}
