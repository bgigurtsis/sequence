import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { saveGoogleRefreshToken } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    // Get the current user - properly await the auth function
    const { userId } = await auth();
    
    // Only logged in users can exchange codes
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

    // Store the refresh token in the database
    await saveGoogleRefreshToken(userId, tokens.refresh_token);
    console.log(`Saved refresh token for user ${userId} to database`);

    return NextResponse.json({
      message: 'Successfully connected your Google Drive',
      success: true
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