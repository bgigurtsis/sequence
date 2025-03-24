import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, NextRequest } from 'next/server';

// Add detailed logging helper
function logWithTimestamp(type: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][Middleware][${type}] ${message}`, data ? data : '');
}

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
  const path = req.nextUrl.pathname;
  const isApi = isApiRoute(req);

  // @ts-ignore - Clerk type definitions might be outdated
  const userId = auth.userId;

  logWithTimestamp('REQUEST', `Processing ${req.method} request for ${path}`, {
    isApi,
    isPublic: isPublicRoute(req),
    hasAuth: !!userId
  });

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    // Check if the user is not authenticated
    if (!userId) {
      logWithTimestamp('AUTH', `Unauthenticated request to protected route: ${path}`);

      // Handle API routes differently - return JSON instead of redirecting
      if (isApi) {
        logWithTimestamp('AUTH', 'Returning 401 for API route');
        return NextResponse.json(
          { error: 'Authentication required' },
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // For regular routes, redirect to sign-in
      const signInUrl = new URL('/sign-in', req.url);
      logWithTimestamp('AUTH', `Redirecting to sign-in: ${signInUrl.toString()}`);
      return Response.redirect(signInUrl);
    }

    logWithTimestamp('AUTH', `Authenticated request for ${path}`, { userId });
  } else {
    logWithTimestamp('AUTH', `Public route accessed: ${path}`);
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