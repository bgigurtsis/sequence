import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
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
    
    // Check if we have a logged-in user via Clerk
    const { userId: clerkUserId } = await auth();
    
    let userId;
    
    if (clerkUserId) {
      // User is already authenticated with Clerk, just connect their Google Drive
      userId = clerkUserId;
      console.log(`Connecting Google Drive for existing Clerk user: ${userId}`);
    } else if (userInfo.data.email) {
      // No Clerk user, create or get one based on Google info
      const { userId: newUserId, sessionToken } = await createClerkUser({
        email: userInfo.data.email,
        firstName: userInfo.data.given_name || '',
        lastName: userInfo.data.family_name || '',
        googleId: userInfo.data.id || '',
        profileImageUrl: userInfo.data.picture || '',
      });
      
      userId = newUserId;
      
      // Set session cookie for the new user
      const cookieStore = cookies();
      cookieStore.set('__session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      console.log(`Created new user with Google authentication: ${userId}`);
    } else {
      return NextResponse.json({ 
        error: 'Could not retrieve user email from Google',
        details: 'Email is required for authentication'
      }, { status: 400 });
    }

    // Store the refresh token in the database
    await saveGoogleRefreshToken(userId, tokens.refresh_token);
    console.log(`Saved refresh token for user ${userId} to database`);

    return NextResponse.json({
      message: 'Successfully connected your Google Drive',
      success: true,
      isNewUser: !clerkUserId
    });
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    
    // Extract more details from Google API errors
    let errorMessage = 'Failed to exchange code';
    let details = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Google API errors often have a response property
      const googleError = error as any;
      if (googleError.response?.data) {
        details = googleError.response.data;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details
      },
      { status: 500 }
    );
  }
}