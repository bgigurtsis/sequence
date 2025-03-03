import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getGoogleRefreshToken } from '@/lib/clerkAuth';
import { checkGoogleDriveConnection } from '@/lib/googleDrive';

export async function GET() {
  try {
    // Get the authenticated user's ID
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { connected: false, message: 'User is not authenticated' },
        { status: 401 }
      );
    }

    // Get the user's Google refresh token
    const refreshToken = await getGoogleRefreshToken(userId);
    
    if (!refreshToken) {
      return NextResponse.json({
        connected: false,
        message: 'User has not connected Google Drive',
        userId
      });
    }

    // Verify the Google Drive connection
    try {
      const isConnected = await checkGoogleDriveConnection(refreshToken);
      return NextResponse.json({
        connected: isConnected,
        message: isConnected ? 'Connected to Google Drive' : 'Google Drive connection failed',
        userId
      });
    } catch (driveError: any) {
      return NextResponse.json({
        connected: false,
        message: driveError.message || 'Error checking Google Drive connection',
        userId
      });
    }

  } catch (error: any) {
    console.error('Error in google-status endpoint:', error);
    return NextResponse.json(
      { 
        connected: false, 
        message: error.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Enable edge runtime for faster response
export const runtime = 'edge'; 