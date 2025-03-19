import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OAuth2Client } from 'google-auth-library';

/**
 * Generates a Google OAuth URL for the user to authorize access to their Google Drive.
 * This is the first step in the OAuth flow.
 */
export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', details: 'You must be logged in to access this endpoint' },
        { status: 401 }
      );
    }
    
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Generate a state parameter to prevent CSRF attacks
    // Include the userId so we know who to associate the tokens with
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    // Generate the auth URL with the correct scope
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',  // Access to files created by this app
      ],
      include_granted_scopes: true,
      prompt: 'consent', // Force consent screen to ensure we get refresh token
      state
    });

    return NextResponse.json({ authUrl });
  } catch (error: unknown) {
    console.error('Error generating Google auth URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: errorMessage },
      { status: 500 }
    );
  }
}