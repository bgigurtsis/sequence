import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';

export async function GET() {
  try {
    // Get the current user from Clerk
    const { userId } = auth();
    
    if (!userId) {
      console.log('/api/auth/me: No authenticated user found');
      return NextResponse.json(
        { authorized: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    console.log(`/api/auth/me: User authenticated with ID: ${userId}`);
    
    // Return the user ID and authentication status
    return NextResponse.json({
      authorized: true,
      userId: userId
    });
  } catch (error) {
    console.error('Error in /api/auth/me endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        authorized: false, 
        message: `Server error: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
} 