import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { getGoogleRefreshToken, checkGoogleDriveConnection } from '@/lib/clerkAuth';

export async function GET() {
  console.log('Google status API called');
  
  try {
    // Get user from Clerk auth
    const { userId } = auth();
    
    if (!userId) {
      console.log('No authenticated user found');
      return NextResponse.json(
        { connected: false, message: 'Not authenticated', userId: null },
        { status: 401 }
      );
    }
    
    console.log(`Checking Google connection for user: ${userId}`);
    
    // Get Google refresh token from Clerk
    const refreshToken = await getGoogleRefreshToken(userId);
    
    if (!refreshToken) {
      console.log('No Google refresh token found');
      return NextResponse.json({
        connected: false,
        message: 'Please connect your Google Drive',
        userId
      });
    }
    
    // Verify the Google Drive connection
    try {
      console.log('Verifying Google connection');
      const isConnected = await checkGoogleDriveConnection(refreshToken);
      
      if (isConnected) {
        console.log('Google Drive connection successful');
        return NextResponse.json({
          connected: true,
          message: 'Connected to Google Drive',
          userId
        });
      } else {
        console.log('Google Drive connection failed verification');
        return NextResponse.json({
          connected: false,
          message: 'Google Drive connection failed',
          userId
        });
      }
    } catch (error) {
      console.error('Error checking Google Drive connection:', error);
      return NextResponse.json({
        connected: false,
        message: `Google Drive error: ${error.message}`,
        userId
      });
    }
  } catch (error) {
    console.error('Unexpected error in Google status API:', error);
    return NextResponse.json(
      { 
        connected: false, 
        message: `Server error: ${error.message}`,
        error: error.stack
      },
      { status: 500 }
    );
  }
} 