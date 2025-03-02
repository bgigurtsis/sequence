import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { google } from 'googleapis';

export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', details: 'You must be logged in to access this endpoint' },
        { status: 401 }
      );
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/google-callback`
    );
    
    // Generate a state parameter to prevent CSRF attacks
    // Include the userId so we know who to associate the tokens with
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    // Generate the auth URL with the correct scope
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      include_granted_scopes: true,
      prompt: 'consent', // Force consent screen to ensure we get refresh token
      state
    });
    
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: error.message },
      { status: 500 }
    );
  }
} 