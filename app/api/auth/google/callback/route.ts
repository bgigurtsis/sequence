import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OAuth2Client } from 'google-auth-library';
import { storeGoogleTokens } from '@/lib/clerkHelpers';

/**
 * Handles the OAuth callback from Google after the user has authorized the application.
 * Exchanges the authorization code for tokens and stores them in Clerk metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Handle error case from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url)
      );
    }
    
    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Validate state parameter to prevent CSRF attacks
    if (stateParam) {
      try {
        const stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
        
        // Verify that the state contains the correct userId
        if (stateData.userId !== userId) {
          throw new Error('State validation failed: user mismatch');
        }
      } catch (error) {
        console.error('State validation error:', error);
        return NextResponse.json(
          { error: 'Invalid state parameter' },
          { status: 400 }
        );
      }
    }

    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in Clerk private metadata
    await storeGoogleTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined, // Convert null to undefined
      expiry_date: tokens.expiry_date || undefined, // Convert null to undefined
    });

    // Redirect to the app with success parameter
    return NextResponse.redirect(new URL('/?google_auth=success', request.url));
  } catch (error: unknown) {
    console.error('Error exchanging code for tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Redirect to app with error
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}