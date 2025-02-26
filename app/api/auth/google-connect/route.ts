import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs';

export async function GET() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get the user's OAuth connections
    const user = await clerkClient.users.getUser(userId);
    
    // Check if user already has Google connected
    const googleOAuth = user.externalAccounts.find(
      account => account.provider === 'google'
    );
    
    // If not connected, redirect to Clerk's OAuth handler
    if (!googleOAuth) {
      return NextResponse.json({ 
        redirectUrl: `/oauth/google?scope=${encodeURIComponent(
          'https://www.googleapis.com/auth/drive.file'
        )}`
      });
    }
    
    // If already connected but no Drive scope, request additional permissions
    // (This depends on how you're implementing the OAuth flow with Clerk)
    
    return NextResponse.json({ 
      connected: true,
      message: 'Google already connected'
    });
  } catch (error) {
    console.error('Error in Google connect:', error);
    return NextResponse.json(
      { error: 'Failed to connect Google' }, 
      { status: 500 }
    );
  }
} 