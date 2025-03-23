import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Generates a Google OAuth URL for the user to authorize access to their Google Drive.
 * This is the first step in the OAuth flow.
 */
export async function GET() {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Your Google OAuth configuration
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
    const redirectUri = encodeURIComponent(GOOGLE_REDIRECT_URI as string);

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    return NextResponse.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Error in Google authorization:', error);
    return NextResponse.json({ error: 'Authorization failed' }, { status: 500 });
  }
}