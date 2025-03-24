// app/api-handlers/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleRefreshToken, saveGoogleToken } from '@/lib/clerkAuth';
import { googleDriveService } from '@/lib/GoogleDriveService';

// Add detailed logging helper
function logWithTimestamp(handler: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][API][auth/${handler}] ${message}`, data ? data : '');
}

/**
 * Get current user and Google Drive connection status
 */
export async function getMe(request: NextRequest): Promise<NextResponse> {
    logWithTimestamp('AUTH', 'getMe called', { url: request.url });

    try {
        const authResult = await auth();
        logWithTimestamp('AUTH', 'Auth result', { auth: !!authResult, userId: authResult.userId });

        const userId = authResult.userId;

        if (!userId) {
            logWithTimestamp('AUTH', 'No userId found', { auth: authResult });
            return NextResponse.json(
                { authenticated: false, error: "Authentication required" },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        logWithTimestamp('AUTH', `User authenticated: ${userId}`);

        // Get the user's Google refresh token
        const refreshToken = await getGoogleRefreshToken(userId);
        logWithTimestamp('AUTH', `Refresh token found: ${!!refreshToken}`);

        // Always return the userId regardless of connection status
        const response = NextResponse.json({
            authenticated: true,
            userId: userId,
            connected: !!refreshToken,
            message: refreshToken
                ? 'User has connected Google Drive'
                : 'User has not connected Google Drive'
        });

        // If refresh token exists, check the connection
        if (refreshToken) {
            try {
                logWithTimestamp('AUTH', 'Checking Google Drive connection');
                const isConnected = await googleDriveService.checkConnection(refreshToken);
                logWithTimestamp('AUTH', `Drive connection check result: ${isConnected}`);

                // Update the response with connection status
                return NextResponse.json({
                    authenticated: true,
                    userId: userId,
                    connected: isConnected,
                    message: isConnected ? 'Connected to Google Drive' : 'Google Drive connection failed'
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
    logWithTimestamp('getGoogleStatus', 'Handler called', { url: request.url });

    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        logWithTimestamp('getGoogleStatus', 'User not authenticated');
        return NextResponse.json(
            { connected: false, message: 'User is not authenticated' },
            { status: 401 }
        );
    }

    // Get the user's Google refresh token
    const refreshToken = await getGoogleRefreshToken(userId);

    if (!refreshToken) {
        return NextResponse.json({
            connected: false,
            message: 'User has not connected Google Drive',
            userId
        });
    }

    // Verify the Google Drive connection
    try {
        const isConnected = await googleDriveService.checkConnection(refreshToken);
        return NextResponse.json({
            connected: isConnected,
            message: isConnected ? 'Connected to Google Drive' : 'Google Drive connection failed',
            userId
        });
    } catch (driveError: any) {
        return NextResponse.json({
            connected: false,
            message: driveError.message || 'Error checking Google Drive connection',
            userId
        });
    }
}

/**
 * Generate a Google auth URL for OAuth flow
 */
export async function getGoogleAuthUrl(request: NextRequest) {
    logWithTimestamp('getGoogleAuthUrl', 'Handler called', { url: request.url });

    try {
        const authResult = await auth();
        const userId = authResult.userId;

        if (!userId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Generate a state parameter to prevent CSRF attacks
        // Include the userId so we know who to associate the tokens with
        const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

        // Use the service to generate the auth URL
        const authUrl = googleDriveService.generateAuthUrl();

        // Add state parameter to the URL
        const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;

        return NextResponse.json({ url: urlWithState });
    } catch (error: any) {
        throw error;
    }
}

/**
 * Exchange OAuth code for tokens
 */
export async function exchangeCode(request: NextRequest) {
    logWithTimestamp('exchangeCode', 'Handler called', { url: request.url });

    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    // Parse request body
    const body = await request.json();
    const { code } = body;

    if (!code) {
        return NextResponse.json(
            { error: 'Missing authorization code' },
            { status: 400 }
        );
    }

    try {
        // Use the service to exchange code for tokens
        const tokens = await googleDriveService.exchangeCodeForTokens(code);

        if (!tokens.refresh_token) {
            return NextResponse.json(
                { error: 'No refresh token received', details: 'Please revoke app permissions in Google account and try again' },
                { status: 400 }
            );
        }

        // Save the refresh token
        const saved = await saveGoogleToken(userId, tokens.refresh_token);

        if (!saved) {
            console.warn('Failed to save token using saveGoogleToken, saving in the response for client to handle');
            // We'll return the token so the client can store it
            return NextResponse.json({
                success: true,
                token: tokens.refresh_token,
                needsClientStorage: true
            });
        }

        return NextResponse.json({ success: true });
    } catch (tokenError: any) {
        throw tokenError;
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
 * Refresh the authentication session
 * This endpoint allows the client to refresh the session without a full sign-in
 */
export async function refreshSession(request: NextRequest): Promise<NextResponse> {
    logWithTimestamp('refreshSession', 'Handler called', { url: request.url });

    try {
        const authResult = await auth();
        const userId = authResult.userId;

        if (!userId) {
            logWithTimestamp('refreshSession', 'No userId found, session expired');
            return NextResponse.json(
                { success: false, message: 'Session expired' },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check if the session is still valid by getting the user data
        logWithTimestamp('refreshSession', `User authenticated: ${userId}`);

        // Return success with the user ID for client caching
        return NextResponse.json({
            success: true,
            message: 'Session refreshed successfully',
            userId: userId
        });
    } catch (error) {
        logWithTimestamp('ERROR', 'Error in refreshSession', { error });
        return NextResponse.json(
            { success: false, message: `Error refreshing session: ${error}` },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
} 