import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { getCachedAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { getOAuthConnectionStatus } from '@/lib/googleOAuthManager';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/auth/refresh-session - Refresh the user's session
 * This is a public route that doesn't require authentication
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/refresh-session');
    log('auth', 'info', 'GET /api/auth/refresh-session called', { 
        requestId, 
        url: request.url,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')
    });
    
    return withErrorHandling(async () => {
        // Get auth status without requiring auth (public route)
        const authStartTime = Date.now();
        log('auth', 'info', 'Getting session status', { requestId });
        const authResult = await getCachedAuth();
        const authDuration = Date.now() - authStartTime;
        
        const userId = authResult.userId;
        
        // Check if session exists
        const hasValidSession = !!userId;
        
        // Get sessionId for debugging
        const sessionId = authResult.sessionId || 'no-session';
        
        log('auth', 'info', `Auth result (took ${authDuration}ms)`, { 
            requestId,
            authenticated: hasValidSession, 
            sessionValid: hasValidSession, 
            userId: userId ? userId.substring(0, 8) + '...' : 'none'
        });
        
        // Check Google connection status if authenticated and required by client
        let googleStatus = null;
        
        if (hasValidSession && (request.nextUrl.searchParams.get('checkGoogle') === 'true')) {
            try {
                log('auth', 'info', 'Checking Google connection status', { requestId, userId });
                const googleStartTime = Date.now();
                const connectionStatus = await getOAuthConnectionStatus(userId);
                const googleDuration = Date.now() - googleStartTime;
                
                googleStatus = {
                    connected: connectionStatus.hasToken,
                    hasAccount: connectionStatus.hasOAuthAccount,
                    needsReconnect: connectionStatus.needsReconnect,
                    provider: connectionStatus.provider
                };
                
                log('auth', 'info', `Google connection status (took ${googleDuration}ms)`, { requestId, ...googleStatus });
            } catch (googleError) {
                const errorMsg = googleError instanceof Error ? googleError.message : String(googleError);
                log('auth', 'warn', 'Error checking Google status', {
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
            log('auth', 'info', 'Google check requested but session is invalid', { requestId });
        } else {
            log('auth', 'info', 'No Google check requested', { requestId });
        }
        
        // Get session expiry time
        let sessionExpiry = null;
        let tokenInfo = null;
        
        if (hasValidSession) {
            log('auth', 'info', 'Extracting session expiry information', { requestId });
            
            // Get the full auth result directly for sessionClaims
            const fullAuthResult = await auth();
            if (fullAuthResult.sessionClaims) {
                const expUtc = fullAuthResult.sessionClaims.exp;
                
                if (expUtc) {
                    // Convert to milliseconds and to a Date
                    const expDate = new Date(expUtc * 1000);
                    const timeLeft = Math.floor((expDate.getTime() - Date.now()) / 1000); // seconds left
                    
                    sessionExpiry = {
                        timestamp: expUtc,
                        date: expDate.toISOString(),
                        timeLeft: timeLeft // seconds left
                    };
                    
                    log('auth', 'info', `Session expiry: ${timeLeft} seconds remaining`, { requestId, expiry: expDate.toISOString() });
                } else {
                    log('auth', 'info', 'No expiry found in session claims', { requestId });
                }
            }
            
            // Extract token-related information for client validation
            if (authResult.getToken) {
                try {
                    log('auth', 'info', 'Attempting to refresh token', { requestId });
                    const tokenStartTime = Date.now();
                    
                    // Get a generic token to trigger refresh
                    await authResult.getToken();
                    const tokenDuration = Date.now() - tokenStartTime;
                    
                    log('auth', 'info', `Token refresh successful (took ${tokenDuration}ms)`, { requestId });
                    
                    tokenInfo = {
                        refreshed: true,
                        timestamp: Date.now()
                    };
                } catch (tokenError) {
                    const errorMsg = tokenError instanceof Error ? tokenError.message : String(tokenError);
                    log('auth', 'warn', 'Error refreshing token', {
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
                log('auth', 'info', 'No getToken method available', { requestId });
            }
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
        
        log('auth', 'info', 'Returning response', {
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
    }, requestId);
}

export const dynamic = 'force-dynamic'; 