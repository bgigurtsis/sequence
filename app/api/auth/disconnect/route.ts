import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteGoogleRefreshToken } from '@/lib/db';

export async function POST() {
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Delete the refresh token from the database
    await deleteGoogleRefreshToken(userId);
    
    return NextResponse.json({
      message: 'Successfully disconnected Google Drive',
      success: true
    });
  } catch (error) {
    console.error('Error disconnecting Google Drive:', error);
    
    return NextResponse.json({ 
      error: 'Failed to disconnect Google Drive',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 