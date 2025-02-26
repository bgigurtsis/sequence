import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkGoogleRefreshToken } from '@/lib/db';

export async function GET() {
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Check if the user has a Google refresh token
    const hasToken = await checkGoogleRefreshToken(userId);
    
    return NextResponse.json({ connected: hasToken });
  } catch (error) {
    console.error('Error checking Google status:', error);
    return NextResponse.json(
      { error: 'Failed to check Google connection status' }, 
      { status: 500 }
    );
  }
} 