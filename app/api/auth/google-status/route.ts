import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { getCachedAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { getOAuthConnectionStatus } from '@/lib/googleOAuthManager';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * GET /api/auth/google-status - Check Google Drive connection status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/google-status');
    log('auth', 'info', 'GET /api/auth/google-status called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        const authResult = await getCachedAuth();
        const userId = authResult.userId;
        const sessionId = authResult.sessionId;

        log('auth', 'info', 'Auth result', { 
            requestId,
            hasAuth: !!authResult, 
            userId,
            sessionId
        });

        // First check for session validity
        if (!sessionId) {
            log('auth', 'info', 'No session found', { requestId });
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
            log('auth', 'info', 'Session exists but user not authenticated', { requestId });
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
        log('auth', 'info', 'Checking Google connection for userId', { requestId, userId });
        
        try {
            // Get detailed connection information
            let connectionStatus;
            try {
                connectionStatus = await getOAuthConnectionStatus(userId);
            } catch (statusError) {
                log('auth', 'error', 'Error retrieving OAuth connection status', {
                    requestId,
                    error: statusError instanceof Error ? statusError.message : String(statusError)
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
            
            log('auth', 'info', 'Google OAuth status', { requestId, ...connectionStatus });

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
                log('auth', 'info', 'Verifying Google API access', { requestId });
                const driveConnected = await googleDriveService.checkConnection(userId);
                
                log('auth', 'info', `Google API access result: ${driveConnected}`, { requestId });
                
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
                log('auth', 'error', 'Error checking Google Drive connection', {
                    requestId,
                    error: driveError instanceof Error ? driveError.message : String(driveError)
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
            log('auth', 'error', 'Error retrieving token information', {
                requestId,
                error: tokenError instanceof Error ? tokenError.message : String(tokenError)
            });
            
            return NextResponse.json({
                connected: false,
                session: true,
                authenticated: true,
                message: 'Error checking Google connection status',
                error: tokenError instanceof Error ? tokenError.message : String(tokenError),
                userId,
                code: 'TOKEN_RETRIEVAL_ERROR'
            }, {
                status: 200  // Return 200 even for errors
            });
        }
    }, requestId);
}

export const dynamic = 'force-dynamic'; 