import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { removeGoogleRefreshToken } from '@/lib/db';

export async function POST() {
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Remove the user's Google refresh token
    await removeGoogleRefreshToken(userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Drive' }, 
      { status: 500 }
    );
  }
} 