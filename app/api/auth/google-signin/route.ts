// app/api/auth/google-signin/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { saveGoogleRefreshToken } from '@/lib/db';
import { cookies } from 'next/headers';
import { createClerkUser } from '@/lib/clerkAuth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing Google OAuth credentials in environment variables' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { 
          error: 'No refresh token returned', 
          details: 'Google did not return a refresh token. Make sure you set prompt=consent and access_type=offline'
        }, 
        { status: 400 }
      );
    }

    // Set the credentials to the oauth2Client
    oauth2Client.setCredentials(tokens);

    // Get the user's profile information
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    const userInfo = await oauth2.userinfo.get();
    
    if (!userInfo.data.email) {
      return NextResponse.json({ error: 'Could not retrieve user email from Google' }, { status: 400 });
    }

    // Create or get the user in Clerk
    const { userId, sessionToken, sessionId } = await createClerkUser({
      email: userInfo.data.email,
      firstName: userInfo.data.given_name || '',
      lastName: userInfo.data.family_name || '',
      googleId: userInfo.data.id || '',
      profileImageUrl: userInfo.data.picture || '',
    });

    // Store the refresh token in the database
    await saveGoogleRefreshToken(userId, tokens.refresh_token);
    console.log(`Saved refresh token for user ${userId} to database`);

    // Set session cookie
    const cookieStore = cookies();
    cookieStore.set('__session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully signed in with Google',
      userId,
      sessionId
    });
  } catch (error: unknown) {
    console.error('Error signing in with Google:', error);
    
    return NextResponse.json({
      error: 'Failed to sign in with Google',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
