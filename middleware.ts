import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { appInitialize, getAdminAuth } from '@/lib/firebase-admin';

// Initialize Firebase Admin
appInitialize();

// Define public routes
const PUBLIC_ROUTES = ['/', '/signin', '/api/auth/session'];

export async function verifyAuthCookie(cookieString: string): Promise<{valid: boolean, uid?: string}> {
  try {
    // Verify the session cookie
    const decodedClaims = await getAdminAuth().verifySessionCookie(cookieString, true);
    return { valid: true, uid: decodedClaims.uid };
  } catch (error) {
    console.error('Invalid session cookie:', error);
    return { valid: false };
  }
}

export async function middleware(request: NextRequest) {
  // Skip for public routes
  if (PUBLIC_ROUTES.some(route => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Get session cookie
  const sessionCookie = request.cookies.get('session')?.value;
  
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  
  try {
    // Verify the session cookie
    const { valid, uid } = await verifyAuthCookie(sessionCookie);
    
    if (!valid) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    
    // Add user ID to headers for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', uid || '');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
    
    return NextResponse.next();
  } catch (error) {
    // Invalid session, redirect to login
    return NextResponse.redirect(new URL('/signin', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
    '/api/(?!auth/session).*',
  ],
};
