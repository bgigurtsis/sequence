// app/api/auth/user/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/clerkAuth';
import { getGoogleUserInfo } from '@/lib/db';

export async function GET() {
  try {
    // First try to get user from Clerk
    const { userId: clerkUserId } = await auth();
    
    if (clerkUserId) {
      // For Clerk users, we would need to fetch user info from Clerk
      // This is typically handled client-side with the useUser hook
      return NextResponse.json({
        message: 'User info is available client-side via Clerk',
        authProvider: 'clerk'
      });
    }
    
    // If no Clerk user, try Google session
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('__session')?.value;
    
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      
      if (session) {
        // Get user info from database
        const userInfo = await getGoogleUserInfo(session.userId);
        
        if (userInfo) {
          return NextResponse.json({
            id: session.userId,
            name: userInfo.name,
            email: userInfo.email,
            imageUrl: userInfo.picture,
            authProvider: 'google'
          });
        }
      }
    }
    
    // No valid session found
    return NextResponse.json({
      authenticated: false,
      message: 'No active session found'
    }, { status: 401 });
  } catch (error: unknown) {
    console.error('Error retrieving user info:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve user info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
