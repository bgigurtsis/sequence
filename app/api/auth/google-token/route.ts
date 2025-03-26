import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * API route to securely retrieve Google OAuth tokens
 * 
 * This route:
 * 1. Authenticates the user
 * 2. Fetches their Google OAuth token from Clerk's token wallet
 * 3. Returns the token for client-side use or handles the request server-side
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated userId
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch the user's OAuth token for Google from Clerk
    const oauthTokens = await clerkClient.users.getUserOauthAccessToken(
      userId,
      'oauth_google'
    );

    // Check if we got a valid token
    if (!oauthTokens || oauthTokens.data.length === 0) {
      return NextResponse.json(
        { error: 'No Google OAuth connection found' },
        { status: 404 }
      );
    }

    // Get the first token (most recent)
    const { token } = oauthTokens.data[0];

    // Create a response with the token information
    // In production, consider whether you need additional security measures
    return NextResponse.json({
      provider: 'google',
      access_token: token,
      status: 'success'
    });
    
  } catch (error) {
    console.error('[GOOGLE-TOKEN-ERROR]', error);
    
    // Return an appropriate error response
    return NextResponse.json(
      { error: 'Failed to retrieve token' },
      { status: 500 }
    );
  }
} 