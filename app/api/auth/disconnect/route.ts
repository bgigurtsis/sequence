import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteGoogleRefreshToken } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/clerkAuth';

export async function POST() {
  try {
    // Try to get user from Clerk first
    const { userId: clerkUserId } = await auth();
    
    // If no Clerk user, try Google session
    let userId: string | undefined = clerkUserId;
    if (!userId) {
      const cookieStore = cookies();
      const sessionToken = cookieStore.get('__session')?.value;
      
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        if (session) {
          userId = session.userId;
        }
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Delete the refresh token from the database
    await deleteGoogleRefreshToken(userId);
    
    return NextResponse.json({
      message: 'Successfully disconnected Google Drive',
      success: true
    });
  } catch (error: unknown) {
    console.error('Error disconnecting Google Drive:', error);
    
    return NextResponse.json({ 
      error: 'Failed to disconnect Google Drive',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}