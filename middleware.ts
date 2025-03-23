import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, NextRequest } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)'
]);

// Checks if a request is for an API route
const isApiRoute = (req: NextRequest): boolean => {
  return req.nextUrl.pathname.startsWith('/api/');
};

export default clerkMiddleware((auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    // Check if the user is not authenticated
    // @ts-ignore - Clerk type definitions might be outdated
    if (!auth.userId) {
      // Handle API routes differently - return JSON instead of redirecting
      if (isApiRoute(req)) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // For regular routes, redirect to sign-in
      const signInUrl = new URL('/sign-in', req.url);
      return Response.redirect(signInUrl);
    }
  }
}, {
  debug: process.env.NODE_ENV === 'development'
});

// Stop the middleware from running on static files
export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
    '/(api|trpc)(.*)',
  ],
};