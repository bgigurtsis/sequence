import { NextResponse } from 'next/server';
import { getUserGoogleAuthClient, getGoogleAuthClient } from '@/lib/googleAuth';
import { auth } from '@clerk/nextjs/server';
import { getGoogleRefreshToken } from '@/lib/db';

export async function GET(request: Request) {
  try {
    console.log('Ping endpoint called, testing Google Drive API connection');
    
    // Get the current user from auth - properly await it
    const { userId } = await auth();
    
    // A specific userId can be passed as a query parameter for testing
    const url = new URL(request.url);
    const testUserId = url.searchParams.get('userId');
    const useEnvToken = url.searchParams.get('useEnvToken') === 'true';
    
    // For testing, we can include a refresh token directly
    const testRefreshToken = url.searchParams.get('refreshToken');
    
    let googleAuth;
    
    // Log which auth method we're using
    if (useEnvToken) {
      console.log('Using environment refresh token for Google Drive API test');
      googleAuth = await getGoogleAuthClient();
    } else if (testUserId && testRefreshToken) {
      console.log(`Using test user ID ${testUserId} and provided refresh token`);
      googleAuth = await getUserGoogleAuthClient(testUserId, testRefreshToken);
    } else if (userId) {
      // Get the user's refresh token from the database
      console.log(`Getting refresh token for user: ${userId} from database`);
      const refreshToken = await getGoogleRefreshToken(userId);
      
      if (refreshToken) {
        console.log('Found refresh token in database for user');
        googleAuth = await getUserGoogleAuthClient(userId, refreshToken);
      } else {
        console.log('No refresh token found for user, falling back to environment token');
        googleAuth = await getGoogleAuthClient();
      }
    } else {
      console.log('No user ID found, using environment refresh token');
      googleAuth = await getGoogleAuthClient();
    }
    
    // Test if we can get the user's about info to verify authentication
    const drive = (await import('googleapis')).google.drive({ version: 'v3', auth: googleAuth });
    const aboutResponse = await drive.about.get({
      fields: 'user',
    });
    
    // Log detailed response for debugging
    console.log('Google API test successful:', aboutResponse.data);
    
    return NextResponse.json({ 
      message: 'Google Drive API connection successful', 
      details: {
        user: aboutResponse.data.user,
        status: 'connected',
        userSpecific: Boolean(userId && !useEnvToken)
      }
    });
  } catch (error) {
    // Log detailed error for debugging
    console.error('Google API test failed:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Unknown error';
    let errorDetails = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack,
        // If it's a Google API error, it might have additional properties
        ...(error as any).response?.data || {}
      };
    }
    
    return NextResponse.json({ 
      error: 'Google Drive API connection failed', 
      message: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
} 