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
    try {
        // First check if Clerk session is valid
        const sessionResponse = await fetch('/api/auth/refresh-session', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        // Parse session response
        const sessionData = await sessionResponse.json().catch(() => ({ 
            success: false, 
            message: 'Could not parse response' 
        }));
        
        // If session is invalid, don't bother checking Google
        if (!sessionResponse.ok || !sessionData.success) {
            return {
                sessionValid: false,
                googleValid: false,
                error: `Session invalid: ${sessionData.message || sessionResponse.statusText}`
            };
        }
        
        // Session is valid, now check Google token
        const googleResponse = await fetch('/api/auth/google-status', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        // Parse Google response
        const googleData = await googleResponse.json().catch(() => ({ 
            connected: false,
            message: 'Could not parse response' 
        }));
        
        return {
            sessionValid: true,
            googleValid: googleResponse.ok && googleData.connected === true,
            error: !googleResponse.ok ? `Google token invalid: ${googleData.message || googleResponse.statusText}` : undefined
        };
    } catch (error) {
        return {
            sessionValid: false,
            googleValid: false,
            error: `Error checking tokens: ${error}`
        };
    }
}

// Function to refresh all tokens (session and Google)
async function refreshAllTokens(enforceGoogleCheck = false): Promise<boolean> {
    try {
        // Step 1: Refresh Clerk session
        const sessionResponse = await fetch('/api/auth/refresh-session', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        const sessionData = await sessionResponse.json().catch(() => ({}));
        
        if (!sessionResponse.ok || !sessionData.success) {
            logWithTimestamp('ERROR', 'Failed to refresh session', { 
                status: sessionResponse.status,
                message: sessionData.message || 'Unknown error'
            });
            return false;
        }
        
        // Only enforce Google check if explicitly requested
        if (!enforceGoogleCheck) {
            return true;
        }
        
        // Step 2: Check Google token - just to make sure it's valid
        const googleResponse = await fetch('/api/auth/google-status', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        
        const googleData = await googleResponse.json().catch(() => ({}));
        
        if (!googleResponse.ok || !googleData.connected) {
            logWithTimestamp('ERROR', 'Google token invalid after refresh', {
                status: googleResponse.status,
                connected: googleData.connected,
                message: googleData.message || 'Unknown error'
            });
            return false;
        }
        
        // All tokens refreshed and valid
        return true;
    } catch (error) {
        logWithTimestamp('ERROR', 'Error refreshing tokens', error);
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

export default function AuthCheck() {
    const { isSignedIn, isLoaded } = useUser();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(false);
    const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
    const lastTokenCheck = useRef<number>(0);
    const MIN_CHECK_INTERVAL = 30000; // 30 seconds between token checks

    // Simplified check - now only runs once and relies on SessionRefresh for periodic checks
    useEffect(() => {
        if (!isLoaded) return;

        // Only check sign-in state once on load, not periodically
        const checkSession = async () => {
            if (isChecking) return;
            if (!isSignedIn) {
                logWithTimestamp('SESSION', 'User not signed in, redirecting to sign-in page');
                router.push('/sign-in');
                return;
            }

            try {
                setIsChecking(true);
                
                // Do a complete token check including Google
                const now = Date.now();
                if (now - lastTokenCheck.current >= MIN_CHECK_INTERVAL) {
                    const tokenStatus = await checkAllTokens();
                    lastTokenCheck.current = now;
                    
                    // Update google connection status
                    setGoogleConnected(tokenStatus.googleValid);
                    
                    if (!tokenStatus.sessionValid) {
                        logWithTimestamp('ERROR', 'Session invalid during check', { error: tokenStatus.error });
                        
                        // Clear local storage state and redirect to sign in
                        sessionStorage.removeItem('lastSessionCheck');
                        sessionStorage.removeItem('userId');
                        sessionStorage.removeItem('sessionId');
                        
                        alert('Your session has expired. Please sign in again to continue.');
                        router.push('/sign-in?session=expired');
                        return;
                    }

                    logWithTimestamp('SESSION', 'Token check complete', { 
                        sessionValid: tokenStatus.sessionValid,
                        googleValid: tokenStatus.googleValid
                    });
                }
                
                // Store the last successful check time
                sessionStorage.setItem('lastSessionCheck', new Date().toISOString());
                
                // Minimal log - we're relying on SessionRefresh for periodic checks
                logWithTimestamp('SESSION', 'Initial session check completed');
            } catch (error) {
                logWithTimestamp('ERROR', 'Error checking session', error);
            } finally {
                setIsChecking(false);
            }
        };

        // Check immediately on component mount
        checkSession();

        // Add handler for critical operations with enhanced token refresh
        const handleCriticalOperation = async (enforceGoogleCheck = false): Promise<boolean> => {
            logWithTimestamp('CRITICAL', 'Refreshing all tokens before critical operation', { enforceGoogleCheck });
            
            // First try using the existing mechanism for compatibility
            if (window.refreshSessionBeforeAction) {
                try {
                    await window.refreshSessionBeforeAction();
                } catch (error) {
                    logWithTimestamp('ERROR', 'Error in legacy session refresh', error);
                }
            }
            
            // Now use our enhanced refresh that also checks Google token
            try {
                // Force a thorough refresh with Google token check
                const success = await refreshAllTokens(enforceGoogleCheck);
                
                if (!success) {
                    // In case of failure, try one more time with a short delay
                    logWithTimestamp('WARNING', 'First token refresh attempt failed, retrying...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await refreshAllTokens(enforceGoogleCheck);
                }
                
                return success;
            } catch (error) {
                logWithTimestamp('ERROR', 'Failed to refresh tokens', error);
                return false;
            }
        };

        // Expose more advanced function globally for critical operations 
        // that includes Google token validation
        // @ts-ignore - Adding to window
        window.refreshBeforeCriticalOperation = handleCriticalOperation;
        
        // Add simpler function specifically for video recording operations
        // that enforces Google token checks
        // @ts-ignore - Adding to window
        window.validateAllTokensForRecording = () => handleCriticalOperation(true);

        return () => {
            // @ts-ignore - Removing from window
            delete window.refreshBeforeCriticalOperation;
            // @ts-ignore - Removing from window
            delete window.validateAllTokensForRecording;
        };
    }, [isLoaded, isSignedIn, router, isChecking]);

    // This component doesn't render anything visible
    return null;
} 