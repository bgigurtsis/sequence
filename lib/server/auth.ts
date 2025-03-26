import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { log } from '../logging';

// Auth cache to prevent multiple auth calls in the same request
let authCache: { 
  userId: string | null; 
  sessionId: string | null; 
  getToken?: Function; 
  timestamp: number 
} | null = null;
const AUTH_CACHE_TTL = 2000; // 2 seconds

/**
 * Get auth result with caching to prevent redundant auth() calls
 */
export async function getCachedAuth() {
    const now = Date.now();
    
    // Use cached auth if recent enough
    if (authCache && (now - authCache.timestamp < AUTH_CACHE_TTL)) {
        return {
            userId: authCache.userId,
            sessionId: authCache.sessionId,
            getToken: authCache.getToken
        };
    }
    
    // Otherwise get fresh auth
    const authResult = await auth();
    authCache = {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        getToken: authResult.getToken,
        timestamp: now
    };
    
    return {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        getToken: authResult.getToken
    };
}

/**
 * Require authentication for an API route
 * Returns the userId if authenticated, or throws a NextResponse error if not
 */
export async function requireAuth(requestId?: string): Promise<string> {
    const { userId } = await getCachedAuth();
    
    if (!userId) {
        log('auth', 'error', 'Authentication required but user not authenticated', { requestId });
        throw NextResponse.json(
            { error: 'Authentication required' },
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }
    
    return userId;
}

/**
 * Try refreshing the session token
 * Useful before operations that require a fresh token
 */
export async function tryRefreshSession(requestId?: string): Promise<void> {
    const { getToken } = await getCachedAuth();
    
    if (getToken) {
        try {
            log('auth', 'info', 'Attempting to refresh session token', { requestId });
            await getToken();
            log('auth', 'info', 'Successfully refreshed session token', { requestId });
        } catch (error) {
            log('auth', 'warning', 'Failed to refresh session, continuing anyway', { 
                requestId, 
                error: error instanceof Error ? error.message : String(error) 
            });
        }
    }
}

/**
 * Validate user session with detailed status information
 * Returns an object with session status or throws a NextResponse error
 * 
 * @param requestId A unique identifier for request tracking
 * @param requireAuth Whether to throw a 401 error if not authenticated
 * @param returnStatus Whether to return status information instead of throwing
 * @returns Object with session validation information
 */
export async function validateUserSession(
    requestId?: string, 
    options?: { 
        requireAuth?: boolean;
        returnStatus?: boolean;
        includeGoogleStatus?: boolean;
    }
) {
    const opts = {
        requireAuth: true,
        returnStatus: false,
        includeGoogleStatus: false,
        ...options
    };
    
    const { userId, sessionId, getToken } = await getCachedAuth();
    
    const result = {
        authenticated: !!userId,
        hasSession: !!sessionId,
        userId,
        sessionId,
        status: userId 
            ? 'authenticated' 
            : (sessionId ? 'session_expired' : 'no_session'),
        code: userId 
            ? 'AUTHENTICATED' 
            : (sessionId ? 'SESSION_EXPIRED' : 'NO_SESSION')
    };
    
    // Log the validation result
    log('auth', userId ? 'info' : 'warning', `Session validation: ${result.status}`, {
        requestId,
        userId: userId || undefined,
        sessionId: sessionId || undefined
    });
    
    // Handle unauthenticated users based on options
    if (!userId && opts.requireAuth) {
        // If we should return status, don't throw
        if (opts.returnStatus) {
            return result;
        }
        
        // Otherwise throw the appropriate error response
        if (!sessionId) {
            // No session
            log('auth', 'error', 'No session found', { requestId });
            throw NextResponse.json(
                { 
                    error: 'Authentication required',
                    code: 'NO_SESSION',
                    message: 'Your session was not found. Please sign in.'
                },
                { 
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Status': 'missing'
                    }
                }
            );
        } else {
            // Session expired
            log('auth', 'error', 'Session expired', { requestId });
            throw NextResponse.json(
                { 
                    error: 'Session expired',
                    code: 'SESSION_EXPIRED',
                    message: 'Your session has expired. Please refresh and try again.'
                },
                { 
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Status': 'expired',
                        'X-Session-Id': sessionId,
                        'X-Refresh-Required': 'true'
                    }
                }
            );
        }
    }
    
    // Try to refresh the token if we have one
    if (userId && getToken) {
        try {
            log('auth', 'info', 'Attempting to refresh session token', { requestId });
            await getToken();
            log('auth', 'info', 'Successfully refreshed session token', { requestId });
        } catch (error) {
            log('auth', 'warning', 'Failed to refresh session, continuing anyway', { 
                requestId, 
                error: error instanceof Error ? error.message : String(error) 
            });
        }
    }
    
    // Additional Google status check if requested
    if (opts.includeGoogleStatus && userId) {
        try {
            const { getOAuthConnectionStatus } = await import('../googleOAuthManager');
            const googleStatus = await getOAuthConnectionStatus(userId);
            
            return {
                ...result,
                googleStatus: {
                    connected: googleStatus.hasToken,
                    hasAccount: googleStatus.hasOAuthAccount,
                    needsReconnect: googleStatus.needsReconnect,
                    provider: googleStatus.provider
                }
            };
        } catch (error) {
            log('auth', 'error', 'Error checking Google connection status', {
                requestId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            return {
                ...result,
                googleStatus: {
                    connected: false,
                    hasAccount: false,
                    needsReconnect: true,
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    
    return result;
} 