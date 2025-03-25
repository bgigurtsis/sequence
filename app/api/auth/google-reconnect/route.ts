import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { getOAuthConnectionStatus } from '@/lib/clerkTokenManager';

/**
 * Handle Google Drive reconnection requests
 * This is used when a user has an OAuth account but no valid token
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][API][auth/google-reconnect] Reconnect handler called`);
  
  try {
    // Get the authenticated user
    const authResult = await auth();
    const userId = authResult.userId;
    const sessionId = authResult.sessionId;
    
    console.log(`[${timestamp}][API][auth/google-reconnect] Auth result`, {
      hasAuth: !!authResult,
      userId,
      sessionId,
      path: request.nextUrl.pathname
    });
    
    // Check authentication
    if (!userId) {
      console.log(`[${timestamp}][API][auth/google-reconnect] No userId found`);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check the current OAuth status
    const status = await getOAuthConnectionStatus(userId);
    
    console.log(`[${timestamp}][API][auth/google-reconnect] OAuth status`, status);
    
    // Generate an auth URL for reconnecting
    try {
      const url = googleDriveService.generateAuthUrl();
      
      // Include the session ID in the state parameter for verification
      const stateParams = new URLSearchParams({
        sessionId: sessionId || '',
        userId,
        reconnect: 'true'
      });
      
      // Add state to the URL
      const urlWithState = `${url}&state=${encodeURIComponent(stateParams.toString())}`;
      
      console.log(`[${timestamp}][API][auth/google-reconnect] Generated auth URL length: ${urlWithState.length}`);
      
      return NextResponse.json({ 
        url: urlWithState,
        hasOAuthAccount: status.hasOAuthAccount,
        needsReconnect: status.needsReconnect,
        userId
      });
    } catch (error) {
      console.error(`[${timestamp}][API][auth/google-reconnect] Error generating auth URL:`, error);
      
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Unknown error generating auth URL',
          code: 'AUTH_URL_ERROR'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[${timestamp}][API][auth/google-reconnect] Error in handler:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 