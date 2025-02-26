import { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs';
import { google } from 'googleapis';
import { saveGoogleToken } from '@/lib/clerkAuth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // If there was an error or user denied access
  if (error) {
    return Response.redirect(new URL('/settings/google-drive?error=access_denied', request.url));
  }
  
  if (!code) {
    return Response.redirect(new URL('/settings/google-drive?error=invalid_request', request.url));
  }
  
  try {
    // Get the current authenticated user
    const { userId } = auth();
    
    if (!userId) {
      return Response.redirect(new URL('/settings/google-drive?error=not_authenticated', request.url));
    }

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google-callback`
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      return Response.redirect(new URL('/settings/google-drive?error=no_refresh_token', request.url));
    }
    
    // Save the refresh token to user's private metadata
    await saveGoogleToken(userId, tokens.refresh_token);
    
    // Redirect to the settings page with success message
    return Response.redirect(new URL('/settings/google-drive?success=connected', request.url));
  } catch (error) {
    console.error('Error in Google callback:', error);
    return Response.redirect(new URL('/settings/google-drive?error=server_error', request.url));
  }
} 