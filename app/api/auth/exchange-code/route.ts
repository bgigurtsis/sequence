import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { saveGoogleToken } from '@/lib/clerkAuth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', details: 'You must be logged in to access this endpoint' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // Create OAuth client and exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/google-callback`
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        return NextResponse.json(
          { error: 'No refresh token received', details: 'Please revoke app permissions in Google account and try again' },
          { status: 400 }
        );
      }

      // Save the refresh token using our enhanced method
      // This will store in both Clerk (if possible) and localStorage
      const saved = await saveGoogleToken(userId, tokens.refresh_token);

      if (!saved) {
        console.warn('Failed to save token using saveGoogleToken, saving in the response for client to handle');
        // We'll return the token so the client can store it
        return NextResponse.json({
          success: true,
          token: tokens.refresh_token,
          needsClientStorage: true
        });
      }

      return NextResponse.json({ success: true });
    } catch (tokenError: unknown) {
      console.error('Error exchanging code for tokens:', tokenError);
      return NextResponse.json(
        { error: 'Failed to exchange code', message: (tokenError as Error).message || String(tokenError) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Error in exchange-code route:', error);
    return NextResponse.json(
      { error: 'Server error', message: (error as Error).message || String(error) },
      { status: 500 }
    );
  }
}