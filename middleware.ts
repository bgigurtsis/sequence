import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)'
]);

export default clerkMiddleware((auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    // Check if the user is not authenticated
    // @ts-ignore - Clerk type definitions might be outdated
    if (!auth.userId) {
      // Use "/sign-in" instead of "/login" since that's Clerk's default path
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

export default authMiddleware({
  publicRoutes: ["/api/auth/google-status"], // Add other public routes if needed
  afterAuth(auth, req) {
    // Handle API responses
    if (req.nextUrl.pathname.startsWith('/api/')) {
      if (!auth.userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
