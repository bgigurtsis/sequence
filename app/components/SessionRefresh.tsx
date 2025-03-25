'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
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
            const essentialKeys = ['success', 'error', 'status', 'userId', 'sessionId', 'code'];
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
        console.error(`[${timestamp}][SessionRefresh][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    } else if (logLevel === 'warn') {
        console.warn(`[${timestamp}][SessionRefresh][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    } else {
        console.log(`[${timestamp}][SessionRefresh][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
    }
}

// Type for session status
interface SessionStatus {
    valid: boolean;
    userId?: string;
    sessionId?: string;
    googleConnected?: boolean;
    lastChecked: number;
    code?: string;
    message?: string;
}

export default function SessionRefresh() {
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
        valid: true,
        lastChecked: 0
    });
    const [consecutiveFailures, setConsecutiveFailures] = useState(0);
    const router = useRouter();
    
    // Store lastRefreshAttempt time to prevent too frequent refreshes
    const lastRefreshAttempt = useRef<number>(0);
    // Minimum time between refresh attempts (15 seconds)
    const MIN_REFRESH_INTERVAL = 15000;

    // Core session refresh function
    const refreshSession = async (checkGoogle = false, force = false): Promise<SessionStatus> => {
        // Throttle refresh attempts unless forced
        const now = Date.now();
        if (!force && now - lastRefreshAttempt.current < MIN_REFRESH_INTERVAL) {
            logWithTimestamp('THROTTLE', `Skipping refresh - too soon since last attempt (${Math.floor((now - lastRefreshAttempt.current) / 1000)}s ago)`);
            return sessionStatus;
        }
        
        lastRefreshAttempt.current = now;
        
        try {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
                logWithTimestamp('INFO', `Attempting to refresh session${checkGoogle ? ' with Google check' : ''}`);
            }
            
            // Build URL with optional Google check
            const url = new URL('/api/auth/refresh-session', window.location.origin);
            if (checkGoogle) {
                url.searchParams.append('checkGoogle', 'true');
            }
            
            const res = await fetch(url.toString(), {
                method: 'GET',
                credentials: 'include',
                headers: { 
                    'Content-Type': 'application/json',
                    // Add cache control to prevent browsers from caching the response
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            // Get session status headers
            const sessionStatusHeader = res.headers.get('X-Session-Status');
            
            // Only log detailed response in development
            if (process.env.NODE_ENV === 'development') {
                logWithTimestamp('REFRESH', 'Session refresh response', {
                    status: res.status,
                    ok: res.ok,
                    statusText: res.statusText,
                    sessionStatus: sessionStatusHeader
                });
            }

            const data = await res.json().catch(() => ({ 
                success: false, 
                message: 'Could not parse response',
                code: 'PARSE_ERROR'
            }));
            
            // Only log detailed response in development
            if (process.env.NODE_ENV === 'development') {
                logWithTimestamp('RESPONSE', 'Session refresh data', data);
            }

            // Handle various error cases
            if (res.status === 401 || (data && !data.success && data.requiresSignIn)) {
                // User needs to sign in again
                logWithTimestamp('AUTH', `No active session, user needs to sign in (Code: ${data.code || 'UNKNOWN'})`);
                
                const newStatus: SessionStatus = {
                    valid: false,
                    lastChecked: now,
                    code: data.code || 'AUTH_ERROR',
                    message: data.message || 'Authentication required'
                };
                
                setSessionStatus(newStatus);
                setConsecutiveFailures(prev => prev + 1);
                
                // After 3 consecutive failures, redirect to sign in
                if (consecutiveFailures >= 2) {
                    logWithTimestamp('AUTH', 'Too many consecutive failures, redirecting to sign-in');
                    window.location.href = '/sign-in?session=expired';
                }
                
                return newStatus;
            }
            
            if (data && !data.success && data.requiresRefresh) {
                // Session exists but needs a proper refresh
                logWithTimestamp('AUTH', 'Session expired but can be refreshed');
                
                const newStatus: SessionStatus = {
                    valid: false,
                    sessionId: data.sessionId,
                    lastChecked: now,
                    code: data.code || 'REFRESH_REQUIRED',
                    message: data.message || 'Session needs refresh'
                };
                
                setSessionStatus(newStatus);
                return newStatus;
            }

            if (!res.ok || !data.success) {
                // Other errors
                logWithTimestamp('ERROR', 'Session refresh failed', {
                    status: res.status,
                    statusText: res.statusText,
                    data
                });
                
                setConsecutiveFailures(prev => prev + 1);
                
                const newStatus: SessionStatus = {
                    valid: false,
                    lastChecked: now,
                    code: data.code || 'REFRESH_ERROR',
                    message: data.message || 'Failed to refresh session'
                };
                
                setSessionStatus(newStatus);
                return newStatus;
            }
            
            // Success case
            if (process.env.NODE_ENV === 'development') {
                logWithTimestamp('SUCCESS', 'Session valid', { 
                    userId: data.userId,
                    sessionId: data.sessionId,
                    googleStatus: data.google
                });
            }
            
            const newStatus: SessionStatus = {
                valid: true,
                userId: data.userId,
                sessionId: data.sessionId,
                googleConnected: data.google?.connected,
                lastChecked: now,
                code: 'SESSION_VALID',
                message: 'Session is valid'
            };
            
            setSessionStatus(newStatus);
            setConsecutiveFailures(0);
            
            // Store session info for other components to use
            if (data.userId) {
                sessionStorage.setItem('userId', data.userId);
            }
            if (data.sessionId) {
                sessionStorage.setItem('sessionId', data.sessionId);
            }
            
            // Also store timestamp of successful auth check
            sessionStorage.setItem('lastSessionCheck', new Date().toISOString());
            
            return newStatus;
        } catch (err) {
            logWithTimestamp('ERROR', 'Error refreshing session', err);
            setConsecutiveFailures(prev => prev + 1);
            
            const newStatus: SessionStatus = {
                valid: false,
                lastChecked: now,
                code: 'NETWORK_ERROR',
                message: err instanceof Error ? err.message : 'Network error during session refresh'
            };
            
            setSessionStatus(newStatus);
            return newStatus;
        }
    };

    useEffect(() => {
        // Run refresh immediately on component mount
        refreshSession();

        // Refresh every 15 minutes (increased from 5 minutes)
        const interval = setInterval(() => refreshSession(), 15 * 60 * 1000);
        
        // Also refresh when user becomes active after being away, but only once per 15 seconds
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const timeSinceLastRefresh = now - lastRefreshAttempt.current;
                
                // Only refresh if it's been at least MIN_REFRESH_INTERVAL since last attempt
                if (timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
                    logWithTimestamp('INFO', 'Page became visible, refreshing session');
                    refreshSession();
                } else {
                    logWithTimestamp('THROTTLE', `Page became visible but skipping refresh (too soon - ${Math.floor(timeSinceLastRefresh / 1000)}s since last attempt)`);
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Add handler for before critical actions
        const handleBeforeAction = async (): Promise<boolean> => {
            try {
                // Force a session refresh before important actions, but only if not too recent
                const now = Date.now();
                const timeSinceLastRefresh = now - lastRefreshAttempt.current;
                
                if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
                    // If we refreshed recently, just use that result
                    logWithTimestamp('ACTION', `Using recent session refresh (${Math.floor(timeSinceLastRefresh / 1000)}s ago)`);
                    return sessionStatus.valid;
                }
                
                logWithTimestamp('ACTION', 'Pre-action session refresh');
                
                // Get a fresh session status
                const status = await refreshSession(false, true);
                return status.valid;
            } catch (err) {
                logWithTimestamp('ERROR', 'Error in pre-action refresh', err);
                return false;
            }
        };
        
        // Handler with Google token check for critical operations
        const handleBeforeCriticalAction = async (enforceGoogleCheck = false): Promise<boolean> => {
            let attempts = 0;
            const maxAttempts = 3;
            const retryDelay = 800; // ms
            
            while (attempts < maxAttempts) {
                try {
                    logWithTimestamp('CRITICAL', `Validation attempt ${attempts + 1}/${maxAttempts}${enforceGoogleCheck ? ' with Google check' : ''}`);
                    
                    // Always force a fresh check for critical actions
                    const status = await refreshSession(enforceGoogleCheck, true);
                    
                    // Success case
                    if (status.valid) {
                        if (enforceGoogleCheck && !status.googleConnected) {
                            logWithTimestamp('ERROR', `Google token check failed on attempt ${attempts + 1}`);
                            
                            // If we have remaining attempts, retry after delay
                            if (attempts < maxAttempts - 1) {
                                logWithTimestamp('RETRY', `Will retry in ${retryDelay}ms`);
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                                attempts++;
                                continue;
                            }
                            
                            return false;
                        }
                        
                        logWithTimestamp('SUCCESS', `Session validation successful on attempt ${attempts + 1}`);
                        return true;
                    }
                    
                    // If we have remaining attempts, retry after delay
                    if (attempts < maxAttempts - 1) {
                        logWithTimestamp('RETRY', `Session invalid, will retry in ${retryDelay}ms`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        attempts++;
                        continue;
                    }
                    
                    // All attempts failed
                    logWithTimestamp('ERROR', 'All validation attempts failed');
                    return false;
                } catch (err) {
                    logWithTimestamp('ERROR', `Error in critical action refresh attempt ${attempts + 1}`, err);
                    
                    // If we have remaining attempts, retry after delay
                    if (attempts < maxAttempts - 1) {
                        logWithTimestamp('RETRY', `Will retry after error in ${retryDelay}ms`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        attempts++;
                        continue;
                    }
                    
                    return false;
                }
            }
            
            // This should not be reached due to the return statements in the loop,
            // but TypeScript requires a return statement at the end of the function
            return false;
        };
        
        // Add a custom validator with detailed logging and retries
        const handleGlobalTokenValidation = async (enforceGoogleCheck = true): Promise<boolean> => {
            // Track validation attempts
            const maxAttempts = 3;
            const tokenCheckId = Date.now().toString().slice(-6);
            
            logWithTimestamp('VALIDATION', `[${tokenCheckId}] Global token validation started with${enforceGoogleCheck ? '' : 'out'} Google check`);
            
            // Attempt validation multiple times with backoff
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    const attemptStart = Date.now();
                    logWithTimestamp('VALIDATION', `[${tokenCheckId}] Attempt ${attempt + 1}/${maxAttempts}`);
                    
                    // Call the critical action handler which does a full session refresh
                    const isValid = await handleBeforeCriticalAction(enforceGoogleCheck);
                    
                    const attemptDuration = Date.now() - attemptStart;
                    if (isValid) {
                        logWithTimestamp('VALIDATION', `[${tokenCheckId}] Success on attempt ${attempt + 1} (${attemptDuration}ms)`);
                        return true;
                    }
                    
                    logWithTimestamp('VALIDATION', `[${tokenCheckId}] Failed attempt ${attempt + 1} (${attemptDuration}ms)`);
                    
                    // Don't retry on the last attempt
                    if (attempt < maxAttempts - 1) {
                        // Exponential backoff
                        const backoffTime = 500 * Math.pow(1.5, attempt);
                        logWithTimestamp('VALIDATION', `[${tokenCheckId}] Retrying in ${backoffTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                    }
                } catch (error) {
                    logWithTimestamp('ERROR', `[${tokenCheckId}] Error during validation attempt ${attempt + 1}`, error);
                    
                    // Don't retry on the last attempt
                    if (attempt < maxAttempts - 1) {
                        // Exponential backoff with longer delay after errors
                        const backoffTime = 800 * Math.pow(1.5, attempt);
                        logWithTimestamp('VALIDATION', `[${tokenCheckId}] Retrying after error in ${backoffTime}ms`);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                    }
                }
            }
            
            logWithTimestamp('VALIDATION', `[${tokenCheckId}] All validation attempts failed`);
            return false;
        };
        
        // For backward compatibility, keep the old name
        // @ts-ignore - Adding to window
        window.refreshSessionBeforeAction = handleBeforeAction;
        
        // Add to global window object for components to call
        // @ts-ignore - Adding to window
        window.refreshBeforeCriticalOperation = handleBeforeCriticalAction;
        
        // Add function specifically for validating all tokens including Google
        // @ts-ignore - Adding to window
        window.validateAllTokensForRecording = () => handleGlobalTokenValidation(true);
        
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            // @ts-ignore - Cleaning up from window
            delete window.refreshSessionBeforeAction;
            // @ts-ignore - Cleaning up from window
            delete window.refreshBeforeCriticalOperation;
            // @ts-ignore - Cleaning up from window
            delete window.validateAllTokensForRecording;
        };
    }, [sessionStatus, consecutiveFailures, router]);

    // This component doesn't render anything
    return null;
} 