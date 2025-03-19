import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OAuth2Client } from 'google-auth-library';
import { storeGoogleTokens } from '@/lib/clerkHelpers';

export async function GET(request: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return NextResponse.json(
      { error: 'No authorization code provided' },
      { status: 400 }
    );
  }

  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    // Fix type issues by converting null to undefined
    await storeGoogleTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined, // Convert null to undefined
      expiry_date: tokens.expiry_date || undefined, // Convert null to undefined
    });

    // Redirect to the app
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return NextResponse.json(
      { error: 'Failed to exchange code for tokens' },
      { status: 500 }
    );
  }
} 