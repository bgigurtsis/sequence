// app/api-handlers/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isGoogleConnected } from '@/lib/clerkTokenManager';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { getOAuthConnectionStatus } from '@/lib/clerkTokenManager';

// Add detailed logging helper
function logWithTimestamp(handler: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][API][auth/${handler}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// Helper function to log request details
function logRequestDetails(request: NextRequest, handler: string) {
    try {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('cookie')) {
                headers[key] = key.toLowerCase().includes('cookie') ? '(cookie content hidden)' : value;
            }
        });
        
        logWithTimestamp(handler, 'Request details', {
            method: request.method,
            url: request.url,
            pathname: new URL(request.url).pathname,
            query: Object.fromEntries(new URL(request.url).searchParams.entries()),
            headers
        });
    } catch (error) {
        logWithTimestamp(handler, 'Error logging request details', error);
    }
}

/**
 * Get current user and Google Drive connection status
 */
export async function getMe(request: NextRequest): Promise<NextResponse> {
    logWithTimestamp('AUTH', 'getMe called');
    logRequestDetails(request, 'getMe');

    try {
        logWithTimestamp('AUTH', 'Getting auth result');
        const authResult = await auth();
        logWithTimestamp('AUTH', 'Auth result', { 
            hasAuth: !!authResult, 
            userId: authResult?.userId,
            sessionId: authResult?.sessionId
        });

        const userId = authResult.userId;

        if (!userId) {
            logWithTimestamp('AUTH', 'No userId found', { auth: authResult });
            return NextResponse.json(
                { authenticated: false, error: "Authentication required" },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        logWithTimestamp('AUTH', `User authenticated: ${userId}`);

        // Check if user has connected Google using Clerk's OAuth wallet
        logWithTimestamp('AUTH', 'Checking Google connection');
        const isConnected = await isGoogleConnected(userId);
        logWithTimestamp('AUTH', `Google connection status: ${isConnected}`);

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
                logWithTimestamp('AUTH', 'Checking Google Drive connection');
                // This will now use the token from Clerk's wallet
                const driveConnected = await googleDriveService.checkConnection(userId);
                logWithTimestamp('AUTH', `Drive connection check result: ${driveConnected}`);

                // Update the response with connection status
                return NextResponse.json({
                    authenticated: true,
                    userId: userId,
                    connected: driveConnected,
                    message: driveConnected ? 'Connected to Google Drive' : 'Google Drive connection failed'
                });
            } catch (driveError: any) {
                logWithTimestamp('AUTH', 'Error checking Drive connection', driveError);
                // Still return userId even if Drive connection fails
                return NextResponse.json({
                    authenticated: true,
                    userId: userId,
                    connected: false,
                    message: driveError.message || 'Error checking Google Drive connection'
                });
            }
        }

        logWithTimestamp('AUTH', 'Sending response', {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
        });

        return response;
    } catch (error) {
        logWithTimestamp('ERROR', 'Error in getMe', { error });
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
    logWithTimestamp('getGoogleStatus', 'Handler called');
    logRequestDetails(request, 'getGoogleStatus');

    try {
        const authResult = await auth();
        const userId = authResult.userId;
        const sessionId = authResult.sessionId;

        logWithTimestamp('getGoogleStatus', 'Auth result', { 
            hasAuth: !!authResult, 
            userId,
            sessionId,
            path: request.nextUrl.pathname
        });

        // First check for session validity
        if (!sessionId) {
            logWithTimestamp('getGoogleStatus', 'No session found');
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
            logWithTimestamp('getGoogleStatus', 'Session exists but user not authenticated');
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
        logWithTimestamp('getGoogleStatus', 'Checking Google connection for userId', { userId });
        
        try {
            // Get detailed connection information using the enhanced function
            const { getOAuthConnectionStatus } = await import('@/lib/clerkTokenManager');
            
            // Catch any errors that might occur during the connection status check
            let connectionStatus;
            try {
                connectionStatus = await getOAuthConnectionStatus(userId);
            } catch (statusError) {
                logWithTimestamp('getGoogleStatus', 'Error retrieving OAuth connection status', {
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
            
            logWithTimestamp('getGoogleStatus', `Google OAuth status`, connectionStatus);

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
                logWithTimestamp('getGoogleStatus', 'Verifying Google API access');
                // This will use the token from Clerk's wallet
                const driveConnected = await googleDriveService.checkConnection(userId);
                
                logWithTimestamp('getGoogleStatus', `Google API access result: ${driveConnected}`);
                
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
                logWithTimestamp('getGoogleStatus', 'Error checking Google Drive connection', {
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
            
            logWithTimestamp('getGoogleStatus', 'Error retrieving token information', errorDetails);
            
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
        
        logWithTimestamp('getGoogleStatus', 'Error in handler', errorInfo);
        
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
    logWithTimestamp('getGoogleAuthUrl', 'Handler called');
    logRequestDetails(request, 'getGoogleAuthUrl');

    try {
        const authResult = await auth();
        const userId = authResult.userId;

        logWithTimestamp('getGoogleAuthUrl', 'Auth result', { 
            hasAuth: !!authResult, 
            userId,
            sessionId: authResult?.sessionId
        });

        if (!userId) {
            logWithTimestamp('getGoogleAuthUrl', 'No userId found');
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Generate a state parameter to prevent CSRF attacks
        // Include the userId so we know who to associate the tokens with
        const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
        logWithTimestamp('getGoogleAuthUrl', 'Generated state parameter', { userId, state });

        // Use the service to generate the auth URL
        try {
            const authUrl = googleDriveService.generateAuthUrl();
            // Add state parameter to the URL
            const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;
            logWithTimestamp('getGoogleAuthUrl', 'Generated auth URL', { urlWithState });

            return NextResponse.json({ url: urlWithState });
        } catch (urlError) {
            logWithTimestamp('getGoogleAuthUrl', 'Error generating URL', urlError);
            throw urlError;
        }
    } catch (error: any) {
        logWithTimestamp('getGoogleAuthUrl', 'Handler error', error);
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
    logWithTimestamp('disconnectGoogle', 'Handler called', { url: request.url });

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
    logWithTimestamp('createSession', 'Handler called', { url: request.url });

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
    logWithTimestamp('getUser', 'Handler called', { url: request.url });

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
    logWithTimestamp('logout', 'Handler called', { url: request.url });

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
    try {
        // Enhanced logging with timestamp
        const timestamp = new Date().toISOString();
        const requestId = request.headers.get('x-request-id') || `refresh-${Date.now().toString(36).substring(2, 10)}`;
        const logPrefix = `[${timestamp}][AuthAPI][refreshSession][${requestId}]`;
        
        console.log(`${logPrefix} Refresh session request received`);
        console.log(`${logPrefix} Headers:`, {
            'user-agent': request.headers.get('user-agent')?.substring(0, 100),
            'content-type': request.headers.get('content-type'),
            'x-real-ip': request.headers.get('x-real-ip'),
            'x-forwarded-for': request.headers.get('x-forwarded-for'),
        });
        
        // Get auth status without requiring auth (public route)
        const authStartTime = Date.now();
        console.log(`${logPrefix} Calling auth() to get session status...`);
        const authResult = await auth();
        const authDuration = Date.now() - authStartTime;
        
        const userId = authResult.userId;
        
        // Check if session exists
        const hasValidSession = !!userId;
        
        // Get sessionId for debugging
        const sessionId = authResult.sessionId || 'no-session';
        
        console.log(`${logPrefix} Auth result (took ${authDuration}ms): ${hasValidSession ? 'Authenticated' : 'Not authenticated'}, session: ${hasValidSession ? 'Valid' : 'Invalid'}, userId: ${userId ? userId.substring(0, 8) + '...' : 'none'}`);
        
        // Check Google connection status if authenticated and required by client
        let googleStatus = null;
        
        if (hasValidSession && (request.nextUrl.searchParams.get('checkGoogle') === 'true')) {
            try {
                console.log(`${logPrefix} Checking Google connection status for userId: ${userId?.substring(0, 8)}...`);
                const googleStartTime = Date.now();
                const connectionStatus = await getOAuthConnectionStatus(userId);
                const googleDuration = Date.now() - googleStartTime;
                
                googleStatus = {
                    connected: connectionStatus.hasToken,
                    hasAccount: connectionStatus.hasOAuthAccount,
                    needsReconnect: connectionStatus.needsReconnect,
                    provider: connectionStatus.provider
                };
                
                console.log(`${logPrefix} Google connection status (took ${googleDuration}ms):`, googleStatus);
            } catch (googleError) {
                const errorMsg = googleError instanceof Error ? googleError.message : String(googleError);
                console.warn(`${logPrefix} Error checking Google status:`, {
                    message: errorMsg,
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
            console.log(`${logPrefix} Google check requested but session is invalid`);
        } else {
            console.log(`${logPrefix} No Google check requested`);
        }
        
        // Get session expiry time
        let sessionExpiry = null;
        let tokenInfo = null;
        
        if (hasValidSession && authResult.sessionClaims) {
            console.log(`${logPrefix} Session claims available, extracting expiry information`);
            
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
                
                console.log(`${logPrefix} Session expiry: ${timeLeft} seconds remaining (${expDate.toISOString()})`);
            } else {
                console.log(`${logPrefix} No expiry found in session claims`);
            }
            
            // Extract token-related information for client validation
            if (authResult.getToken) {
                try {
                    console.log(`${logPrefix} Attempting to refresh token...`);
                    const tokenStartTime = Date.now();
                    
                    // Get a generic token to trigger refresh
                    await authResult.getToken();
                    const tokenDuration = Date.now() - tokenStartTime;
                    
                    console.log(`${logPrefix} Token refresh successful (took ${tokenDuration}ms)`);
                    
                    tokenInfo = {
                        refreshed: true,
                        timestamp: Date.now()
                    };
                } catch (tokenError) {
                    const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
                    console.warn(`${logPrefix} Error refreshing token:`, {
                        message: errorMsg,
                        stack: tokenError instanceof Error ? tokenError.stack?.substring(0, 500) : 'No stack trace'
                    });
                    
                    tokenInfo = {
                        refreshed: false,
                        error: errorMsg
                    };
                }
            } else {
                console.log(`${logPrefix} No getToken method available on authResult`);
            }
        } else if (hasValidSession) {
            console.log(`${logPrefix} Session valid but no session claims available`);
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
        
        console.log(`${logPrefix} Returning response with status:`, {
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
        
        console.error('Error in refreshSession:', {
            message: errorMsg,
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