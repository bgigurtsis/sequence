import { NextRequest, NextResponse } from 'next/server';

// Define public routes
const PUBLIC_ROUTES = ['/', '/signin', '/api/auth/session'];

export function middleware(request: NextRequest) {
  // Check for session cookie without using Firebase Admin
  const session = request.cookies.get('session')?.value;
  
  // If no session exists, redirect to login
  if (!session && !request.nextUrl.pathname.startsWith('/signin') 
      && !request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  
  // Get response
  const res = NextResponse.next();

  // Add CORS headers
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', request.headers.get('origin') || '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|signin).*)',
  ],
};
