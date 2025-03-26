// app/api-handlers/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isGoogleConnected, getOAuthConnectionStatus } from '@/lib/googleOAuthManager';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { log, generateRequestId } from '@/lib/logging';

// Helper function to log request details
function logRequestDetails(request: NextRequest, handler: string, requestId: string) {
    try {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('cookie')) {
                headers[key] = key.toLowerCase().includes('cookie') ? '(cookie content hidden)' : value;
            }
        });
        
        log('api', 'info', `[${handler}] Request details`, {
            requestId,
            method: request.method,
            url: request.url,
            pathname: new URL(request.url).pathname,
            query: Object.fromEntries(new URL(request.url).searchParams.entries()),
            headers
        });
    } catch (error) {
        log('api', 'error', `[${handler}] Error logging request details`, { 
            requestId,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * Get current user and Google Drive connection status
 */
export async function getMe(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/me');
    log('api', 'info', 'getMe called', { requestId });
    logRequestDetails(request, 'getMe', requestId);

    try {
        log('api', 'info', 'Getting auth result', { requestId });
        const authResult = await auth();
        log('api', 'info', 'Auth result', { 
            requestId,
            hasAuth: !!authResult, 
            userId: authResult?.userId,
            sessionId: authResult?.sessionId
        });

        const userId = authResult.userId;

        if (!userId) {
            log('api', 'error', 'No userId found', { requestId, auth: authResult });
            return NextResponse.json(
                { authenticated: false, error: "Authentication required" },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        log('api', 'info', `User authenticated: ${userId}`, { requestId });

        // Check if user has connected Google using Clerk's OAuth wallet
        log('api', 'info', 'Checking Google connection', { requestId });
        const isConnected = await isGoogleConnected(userId);
        log('api', 'info', `Google connection status: ${isConnected}`, { requestId });

        // Always return the userId regardless of connection status
        const response = NextResponse.json({
            authenticated: true,
            userId: userId,
            connected: isConnected,
            message: isConnected
                ? 'User has connected Google Drive'
                : 'User has not connected Google Drive'
        });

        // If user is connected to Google, also check the Drive connection
        if (isConnected) {
            try {
                log('api', 'info', 'Checking Google Drive connection', { requestId });
                // This will now use the token from Clerk's wallet
                const driveConnected = await googleDriveService.checkConnection(userId);
                log('api', 'info', `Drive connection check result: ${driveConnected}`, { requestId });

                // Update the response with connection status
                return NextResponse.json({
                    authenticated: true,
                    userId: userId,
                    connected: driveConnected,
                    message: driveConnected ? 'Connected to Google Drive' : 'Google Drive connection failed'
                });
            } catch (driveError: any) {
                log('api', 'error', 'Error checking Drive connection', { 
                    requestId,
                    error: driveError instanceof Error ? driveError.message : String(driveError)
                });
                // Still return userId even if Drive connection fails
                return NextResponse.json({
                    authenticated: true,
                    userId: userId,
                    connected: false,
                    message: driveError.message || 'Error checking Google Drive connection'
                });
            }
        }

        log('api', 'info', 'Sending response', {
            requestId,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
        });

        return response;
    } catch (error) {
        log('api', 'error', 'Error in getMe', { 
            requestId, 
            error: error instanceof Error ? error.message : String(error) 
        });
        return NextResponse.json(
            { authenticated: false, error: `Error checking authentication: ${error}` },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * Check Google Drive connection status
 */
export async function getGoogleStatus(request: NextRequest) {
    const requestId = generateRequestId('GET', 'auth/google-status');
    log('api', 'info', 'getGoogleStatus called', { requestId });
    logRequestDetails(request, 'getGoogleStatus', requestId);

    try {
        const authResult = await auth();
        const userId = authResult.userId;
        const sessionId = authResult.sessionId;

        log('api', 'info', 'Auth result', { 
            requestId,
            hasAuth: !!authResult, 
            userId,
            sessionId,
            path: request.nextUrl.pathname
        });

        // First check for session validity
        if (!sessionId) {
            log('api', 'info', 'No session found', { requestId });
            return NextResponse.json(
                { 
                    connected: false, 
                    session: false,
                    message: 'No active session found',
                    code: 'NO_SESSION'
                },
                { 
                    status: 200,  // Return 200 instead of 401 to avoid middleware conflicts
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'X-Session-Status': 'missing'
                    }
                }
            );
        }

        if (!userId) {
            log('api', 'info', 'Session exists but user not authenticated', { requestId });
            return NextResponse.json(
                { 
                    connected: false, 
                    session: true,
                    authenticated: false,
                    message: 'Session exists but user is not authenticated',
                    code: 'SESSION_INVALID'
                },
                { 
                    status: 200,  // Return 200 to prevent middleware conflicts
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'X-Session-Status': 'invalid',
                        'X-Session-Id': sessionId
                    }
                }
            );
        }

        // User is authenticated, now check Google connection
        log('api', 'info', 'Checking Google connection for userId', { requestId, userId });
        
        try {
            // Get detailed connection information using the enhanced function
            const { getOAuthConnectionStatus } = await import('@/lib/googleOAuthManager');
            
            // Catch any errors that might occur during the connection status check
            let connectionStatus;
            try {
                connectionStatus = await getOAuthConnectionStatus(userId);
            } catch (statusError) {
                log('api', 'error', 'Error retrieving OAuth connection status', {
                    requestId,
                    error: statusError instanceof Error ? statusError.message : String(statusError),
                    stack: statusError instanceof Error ? statusError.stack : null
                });
                
                return NextResponse.json({
                    connected: false,
                    session: true,
                    authenticated: true,
                    message: 'Error checking Google connection status',
                    error: statusError instanceof Error ? statusError.message : 'Unknown error checking connection status',
                    code: 'CONNECTION_STATUS_ERROR'
                }, {
                    status: 200 // Return 200 even for errors to prevent middleware conflicts
                });
            }
            
            log('api', 'info', 'Google OAuth status', { requestId, connectionStatus });

            // If user has no token or needs to reconnect, return appropriate status
            if (!connectionStatus.hasToken) {
                return NextResponse.json({
                    connected: false,
                    session: true,
                    authenticated: true,
                    message: connectionStatus.hasOAuthAccount 
                        ? 'OAuth account exists but needs reconnection' 
                        : 'User has not connected Google Drive',
                    needsReconnect: connectionStatus.needsReconnect,
                    hasOAuthAccount: connectionStatus.hasOAuthAccount,
                    userId,
                    code: connectionStatus.needsReconnect 
                        ? 'NEEDS_RECONNECT' 
                        : 'NO_GOOGLE_CONNECTION',
                    error: connectionStatus.tokenError
                });
            }

            // If we have a token, verify the Google Drive connection by making a test API call
            try {
                log('api', 'info', 'Verifying Google API access', { requestId });
                // This will use the token from Clerk's wallet
                const driveConnected = await googleDriveService.checkConnection(userId);
                
                log('api', 'info', 'Google API access result', { requestId, driveConnected });
                
                return NextResponse.json({
                    connected: driveConnected,
                    session: true,
                    authenticated: true,
                    hasOAuthAccount: connectionStatus.hasOAuthAccount,
                    message: driveConnected ? 'Connected to Google Drive' : 'Google Drive connection failed',
                    provider: connectionStatus.provider,
                    userId,
                    code: driveConnected ? 'GOOGLE_CONNECTED' : 'GOOGLE_CONNECTION_FAILED'
                });
            } catch (driveError) {
                log('api', 'error', 'Error checking Google Drive connection', {
                    requestId,
                    error: driveError instanceof Error ? driveError.message : String(driveError),
                    stack: driveError instanceof Error ? driveError.stack : null
                });
                
                // Check for specific error conditions that indicate token problems
                const errorMessage = driveError instanceof Error ? driveError.message : String(driveError);
                const isTokenError = errorMessage.includes('token') || 
                                    errorMessage.includes('auth') || 
                                    errorMessage.includes('permission') ||
                                    errorMessage.includes('invalid');
                
                return NextResponse.json({
                    connected: false,
                    session: true,
                    authenticated: true,
                    hasOAuthAccount: connectionStatus.hasOAuthAccount,
                    message: isTokenError ? 
                        'Google Drive token is invalid or expired' : 
                        'Error connecting to Google Drive',
                    error: errorMessage,
                    tokenError: isTokenError,
                    userId,
                    code: isTokenError ? 'GOOGLE_TOKEN_ERROR' : 'GOOGLE_CONNECTION_ERROR'
                }, {
                    status: 200  // Return 200 even for token errors to prevent middleware blocking
                });
            }
        } catch (tokenError) {
            // Enhanced error logging
            const errorDetails = {
                message: tokenError instanceof Error ? tokenError.message : 'Unknown token error',
                name: tokenError instanceof Error ? tokenError.name : 'UnknownError',
                stack: tokenError instanceof Error ? tokenError.stack : null
            };
            
            log('api', 'error', 'Error retrieving token information', {
                requestId,
                errorDetails: errorDetails instanceof Error ? errorDetails.message : String(errorDetails)
            });
            
            return NextResponse.json({
                connected: false,
                session: true,
                authenticated: true,
                message: 'Error checking Google connection status',
                error: errorDetails.message,
                errorType: errorDetails.name,
                userId,
                code: 'TOKEN_RETRIEVAL_ERROR'
            }, {
                status: 200  // Return 200 even for errors
            });
        }
    } catch (error) {
        // Enhanced error logging for general issues
        const errorInfo = {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'UnknownError',
            stack: error instanceof Error ? error.stack : null
        };
        
        log('api', 'error', 'Error in handler', {
            requestId,
            errorInfo: errorInfo instanceof Error ? errorInfo.message : String(errorInfo)
        });
        
        return NextResponse.json({
            connected: false,
            message: `Error checking connection: ${errorInfo.message}`,
            error: errorInfo.message,
            errorType: errorInfo.name,
            code: 'SERVER_ERROR'
        }, { 
            status: 200
        });
    }
}

/**
 * Generate a Google auth URL for OAuth flow
 */
export async function getGoogleAuthUrl(request: NextRequest) {
    const requestId = generateRequestId('GET', 'auth/google-auth-url');
    log('api', 'info', 'getGoogleAuthUrl called', { requestId });
    logRequestDetails(request, 'getGoogleAuthUrl', requestId);

    try {
        const authResult = await auth();
        const userId = authResult.userId;

        log('api', 'info', 'Auth result', { 
            requestId,
            hasAuth: !!authResult, 
            userId,
            sessionId: authResult?.sessionId
        });

        if (!userId) {
            log('api', 'error', 'No userId found', { requestId });
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Generate a state parameter to prevent CSRF attacks
        // Include the userId so we know who to associate the tokens with
        const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
        log('api', 'info', 'Generated state parameter', { requestId, userId, state });

        // Use the service to generate the auth URL
        try {
            const authUrl = googleDriveService.generateAuthUrl();
            // Add state parameter to the URL
            const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;
            log('api', 'info', 'Generated auth URL', { requestId, urlWithState });

            return NextResponse.json({ url: urlWithState });
        } catch (urlError) {
            log('api', 'error', 'Error generating URL', { requestId, error: urlError instanceof Error ? urlError.message : String(urlError) });
            throw urlError;
        }
    } catch (error: any) {
        log('api', 'error', 'Handler error', { requestId, error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: `Failed to generate auth URL: ${error.message || String(error)}` }, 
            { status: 500 }
        );
    }
}

/**
 * Disconnect Google Drive
 */
export async function disconnectGoogle(request: NextRequest) {
    const requestId = generateRequestId('POST', 'auth/disconnect-google');
    log('api', 'info', 'disconnectGoogle called', { requestId, url: request.url });

    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    try {
        // This would typically revoke tokens and clear saved tokens
        // For this example, we'll just return success
        return NextResponse.json({
            success: true,
            message: 'Successfully disconnected Google Drive'
        });
    } catch (error) {
        throw error;
    }
}

/**
 * Create a session
 */
export async function createSession(request: NextRequest) {
    const requestId = generateRequestId('POST', 'auth/create-session');
    log('api', 'info', 'createSession called', { requestId, url: request.url });

    try {
        // Session creation logic would go here
        return NextResponse.json({
            success: true,
            sessionId: 'sample-session-id'
        });
    } catch (error) {
        throw error;
    }
}

/**
 * Get user details
 */
export async function getUser(request: NextRequest) {
    const requestId = generateRequestId('GET', 'auth/user');
    log('api', 'info', 'getUser called', { requestId, url: request.url });

    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    try {
        // User fetching logic would go here
        return NextResponse.json({
            userId,
            email: 'user@example.com', // This would be fetched from user data
            name: 'Example User'
        });
    } catch (error) {
        throw error;
    }
}

/**
 * Logout user
 */
export async function logout(request: NextRequest) {
    const requestId = generateRequestId('POST', 'auth/logout');
    log('api', 'info', 'logout called', { requestId, url: request.url });

    try {
        // Logout logic would go here
        return NextResponse.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        throw error;
    }
}

/**
 * Refresh user's session
 */
export async function refreshSession(request: NextRequest) {
    const requestId = generateRequestId('GET', 'auth/refresh-session');
    log('api', 'info', 'refreshSession called', { 
        requestId,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')
    });
    
    try {
        // Get auth status without requiring auth (public route)
        const authStartTime = Date.now();
        log('api', 'info', 'Getting session status', { requestId });
        const authResult = await auth();
        const authDuration = Date.now() - authStartTime;
        
        const userId = authResult.userId;
        
        // Check if session exists
        const hasValidSession = !!userId;
        
        // Get sessionId for debugging
        const sessionId = authResult.sessionId || 'no-session';
        
        log('api', 'info', 'Auth result', { 
            requestId, 
            authenticated: hasValidSession, 
            sessionValid: hasValidSession, 
            userId: userId ? `${userId.substring(0, 8)}...` : 'none',
            duration: `${authDuration}ms`
        });
        
        // Check Google connection status if authenticated and required by client
        let googleStatus = null;
        
        if (hasValidSession && (request.nextUrl.searchParams.get('checkGoogle') === 'true')) {
            try {
                log('api', 'info', 'Checking Google connection status', { requestId, userId });
                const googleStartTime = Date.now();
                const connectionStatus = await getOAuthConnectionStatus(userId);
                const googleDuration = Date.now() - googleStartTime;
                
                googleStatus = {
                    connected: connectionStatus.hasToken,
                    hasAccount: connectionStatus.hasOAuthAccount,
                    needsReconnect: connectionStatus.needsReconnect,
                    provider: connectionStatus.provider
                };
                
                log('api', 'info', 'Google connection status', { 
                    requestId, 
                    duration: `${googleDuration}ms`,
                    ...googleStatus
                });
            } catch (googleError) {
                const errorMsg = googleError instanceof Error ? googleError.message : String(googleError);
                log('api', 'warn', 'Error checking Google status', {
                    requestId,
                    error: errorMsg,
                    stack: googleError instanceof Error ? googleError.stack?.substring(0, 500) : 'No stack trace'
                });
                
                googleStatus = {
                    connected: false,
                    hasAccount: false,
                    needsReconnect: true,
                    error: errorMsg
                };
            }
        } else if (request.nextUrl.searchParams.get('checkGoogle') === 'true') {
            log('api', 'info', 'Google check requested but session is invalid', { requestId });
        } else {
            log('api', 'info', 'No Google check requested', { requestId });
        }
        
        // Get session expiry time
        let sessionExpiry = null;
        let tokenInfo = null;
        
        if (hasValidSession && authResult.sessionClaims) {
            log('api', 'info', 'Extracting session expiry information', { requestId });
            
            // @ts-ignore - Expiry is in sessionClaims
            const expUtc = authResult.sessionClaims.exp;
            
            if (expUtc) {
                // Convert to milliseconds and to a Date
                const expDate = new Date(expUtc * 1000);
                const timeLeft = Math.floor((expDate.getTime() - Date.now()) / 1000); // seconds left
                
                sessionExpiry = {
                    timestamp: expUtc,
                    date: expDate.toISOString(),
                    timeLeft: timeLeft // seconds left
                };
                
                log('api', 'info', 'Session expiry', { 
                    requestId, 
                    secondsRemaining: timeLeft,
                    expiry: expDate.toISOString()
                });
            } else {
                log('api', 'info', 'No expiry found in session claims', { requestId });
            }
            
            // Extract token-related information for client validation
            if (authResult.getToken) {
                try {
                    log('api', 'info', 'Attempting to refresh token', { requestId });
                    const tokenStartTime = Date.now();
                    
                    // Get a generic token to trigger refresh
                    await authResult.getToken();
                    const tokenDuration = Date.now() - tokenStartTime;
                    
                    log('api', 'info', 'Token refresh successful', { 
                        requestId,
                        duration: `${tokenDuration}ms`
                    });
                    
                    tokenInfo = {
                        refreshed: true,
                        timestamp: Date.now()
                    };
                } catch (tokenError) {
                    const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
                    log('api', 'warn', 'Error refreshing token', {
                        requestId,
                        error: errorMsg,
                        stack: tokenError instanceof Error ? tokenError.stack?.substring(0, 500) : 'No stack trace'
                    });
                    
                    tokenInfo = {
                        refreshed: false,
                        error: errorMsg
                    };
                }
            } else {
                log('api', 'info', 'No getToken method available', { requestId });
            }
        } else if (hasValidSession) {
            log('api', 'info', 'Session valid but no session claims available', { requestId });
        }
        
        const response = { 
            success: hasValidSession,
            authenticated: hasValidSession,
            sessionId: hasValidSession ? sessionId : null,
            userId: hasValidSession ? userId : null,
            sessionExpiry,
            googleStatus,
            tokenInfo,
            timestamp: Date.now()
        };
        
        log('api', 'info', 'Returning response', {
            requestId,
            success: response.success,
            authenticated: response.authenticated,
            hasSessionId: !!response.sessionId,
            hasUserId: !!response.userId,
            hasExpiry: !!response.sessionExpiry,
            hasGoogleStatus: !!response.googleStatus,
            hasTokenInfo: !!response.tokenInfo
        });
                        
        return NextResponse.json(response);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : 'No stack trace';
        
        log('api', 'error', 'Error in refreshSession', {
            requestId,
            error: errorMsg,
            stack: stack?.substring(0, 500)
        });
        
        return NextResponse.json({ 
            success: false,
            authenticated: false, 
            error: errorMsg,
            timestamp: Date.now()
        }, { status: 500 });
    }
}