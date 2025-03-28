import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserGoogleAuthClient } from '@/lib/googleOAuthManager';
import { log } from '@/lib/logging';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    log('auth', 'info', 'Google scopes endpoint called', { userId });
    
    // Get OAuth client for the user
    const oauthClient = await getUserGoogleAuthClient(userId);
    
    if (!oauthClient) {
      return NextResponse.json(
        { error: 'Failed to get Google OAuth client' },
        { status: 400 }
      );
    }

    // Check if we have credentials at all
    if (!oauthClient.credentials || !oauthClient.credentials.access_token) {
      return NextResponse.json(
        { error: 'No OAuth credentials available' },
        { status: 400 }
      );
    }
    
    // Get token info directly from Google's tokeninfo endpoint
    const accessToken = oauthClient.credentials.access_token;
    let tokenInfo = null;
    
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
      
      if (response.ok) {
        tokenInfo = await response.json();
      } else {
        const errorData = await response.json();
        log('auth', 'error', 'Token info request failed', { status: response.status, error: errorData });
      }
    } catch (error) {
      log('auth', 'error', 'Failed to fetch token info', { error });
    }
    
    // Check for drive.file scope
    const scope = tokenInfo?.scope || '';
    const hasDriveFileScope = scope.includes('https://www.googleapis.com/auth/drive.file');
    
    return NextResponse.json({
      success: true,
      userId,
      tokenInfo,
      hasToken: true,
      hasRefreshToken: !!oauthClient.credentials.refresh_token,
      tokenExpiry: oauthClient.credentials.expiry_date 
        ? new Date(oauthClient.credentials.expiry_date).toISOString() 
        : null,
      scopes: scope.split(' '),
      hasDriveFileScope
    });
    
  } catch (error: any) {
    console.error('Error checking Google scopes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 