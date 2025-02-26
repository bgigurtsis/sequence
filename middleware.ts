import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Create a matcher for public routes
const isPublicRoute = createRouteMatcher([
  '/',
  '/signin(.*)',
  '/signup(.*)',
  '/verify(.*)',
  '/api/ping',
  '/api/auth/clerk-webhook',
  '/_next/(.*)' // Allow Next.js assets
]);

export default clerkMiddleware((auth, req) => {
  // Allow public routes without authentication
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!auth.userId) {
    // If it's an API route, return 401 Unauthorized
    if (req.nextUrl?.pathname?.startsWith('/api/')) {
      return NextResponse.json(
        { error: "Authentication required", details: "You must be logged in to access this endpoint" },
        { status: 401 }
      );
    }
    // For non-API routes, redirect to sign in
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  // User is authenticated, allow the request
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
