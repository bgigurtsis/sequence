// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear the session cookie
    const cookieStore = cookies();
    cookieStore.delete('__session');
    
    return NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (error: unknown) {
    console.error('Error during logout:', error);
    
    return NextResponse.json({
      error: 'Failed to log out',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
