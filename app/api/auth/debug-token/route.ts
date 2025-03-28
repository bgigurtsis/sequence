import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserGoogleAuthClient } from '@/lib/googleOAuthManager';
import { log } from '@/lib/logging';

/**
 * Debug endpoint to extract Google OAuth token for testing
 * IMPORTANT: This endpoint should be disabled in production
 */
export async function GET(request: NextRequest) {
  // Check if in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    log('auth', 'info', 'Debug token endpoint called', { 
      userId,
      path: '/api/auth/debug-token'
    });
    
    // Get the OAuth client which contains the token
    const oauthClient = await getUserGoogleAuthClient(userId);
    
    if (!oauthClient || !oauthClient.credentials) {
      return NextResponse.json(
        { error: 'No OAuth client or credentials available' },
        { status: 400 }
      );
    }
    
    // Extract tokens
    const { access_token, refresh_token, expiry_date } = oauthClient.credentials;
    
    if (!access_token) {
      return NextResponse.json(
        { error: 'No access token available' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      access_token,
      refresh_token: refresh_token || null,
      expiry_date: expiry_date || null,
      message: 'This token can be used with the test-google-drive.js script',
      userId
    });
    
  } catch (error) {
    console.error('Error getting debug token:', error);
    return NextResponse.json(
      { error: 'Failed to get token' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 