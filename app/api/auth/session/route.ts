// app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/clerkAuth';

export async function GET() {
  try {
    // First try to get user from Clerk
    const { userId: clerkUserId } = await auth();
    
    if (clerkUserId) {
      return NextResponse.json({
        userId: clerkUserId,
        authProvider: 'clerk'
      });
    }
    
    // If no Clerk user, try Google session
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('__session')?.value;
    
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      
      if (session) {
        return NextResponse.json({
          userId: session.userId,
          sessionId: session.sessionId,
          authProvider: 'google'
        });
      }
    }
    
    // No valid session found
    return NextResponse.json({
      authenticated: false,
      message: 'No active session found'
    }, { status: 401 });
  } catch (error) {
    console.error('Error retrieving session:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
