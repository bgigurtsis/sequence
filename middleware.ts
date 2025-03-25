import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, NextRequest } from 'next/server';

// Track requests to detect duplicates
const processedRequests = new Map<string, number>();

// Add detailed logging helper with log levels
function logWithTimestamp(type: string, message: string, data?: any) {
  // Only log errors and warnings in production, all logs in development
  const isProd = process.env.NODE_ENV === 'production';
  const logLevel = type === 'ERROR' || type === 'AUTH' ? 'error' : 
                  type === 'WARNING' ? 'warn' : 'info';
  
  // Skip verbose logs in production
  if (isProd && logLevel === 'info' && !message.includes('error') && !message.includes('fail')) {
    return;
  }
  
  // Simplify data logging in production
  const timestamp = new Date().toISOString();
  let logData = data;
  
  // In production, only log essential data
  if (isProd && data) {
    // If data is an object, only keep essential properties
    if (typeof data === 'object' && data !== null) {
      const essentialKeys = ['userId', 'sessionId', 'error', 'status', 'success', 'requestId'];
      const simplifiedData: Record<string, any> = {};
      
      for (const key of essentialKeys) {
        if (key in data) {
          simplifiedData[key] = data[key];
        }
      }
      
      logData = Object.keys(simplifiedData).length > 0 ? simplifiedData : null;
    }
  }
  
  // Use appropriate console method based on log level
  if (logLevel === 'error') {
    console.error(`[${timestamp}][Middleware][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
  } else if (logLevel === 'warn') {
    console.warn(`[${timestamp}][Middleware][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
  } else {
    console.log(`[${timestamp}][Middleware][${type}] ${message}`, logData ? JSON.stringify(logData, null, 2) : '');
  }
}

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth/google-callback',  // Make OAuth callback public
  '/api/auth/refresh-session',  // Allow session refresh without auth
  '/api/auth/google-status',    // Make Google status check public
  '/api/auth/google-reconnect'  // Make reconnection endpoint public
]);

// Checks if a request is for an API route
const isApiRoute = (req: NextRequest): boolean => {
  return req.nextUrl.pathname.startsWith('/api/');
};

// Detailed Auth header inspection for debugging
function inspectAuthHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('cookie')) {
      headers[key] = key.toLowerCase().includes('cookie') ? '(cookie content hidden)' : value;
    }
  });
  return headers;
}

// Generate a unique request ID
function generateRequestId(req: NextRequest): string {
  const timestamp = Date.now();
  const url = req.nextUrl.pathname;
  const method = req.method;
  return `${method}-${url}-${timestamp}`;
}

// Middleware function
export default clerkMiddleware((auth, req) => {
  // Generate a unique ID for this request to detect duplicates
  const requestId = generateRequestId(req);
  
  // Check if this is a duplicate request
  if (processedRequests.has(requestId)) {
    const count = processedRequests.get(requestId) || 0;
    processedRequests.set(requestId, count + 1);
    
    // If we've seen this request before, log and skip processing
    if (count > 0) {
      logWithTimestamp('DUPLICATE', `Skipping duplicate request (${count + 1}): ${req.method} ${req.nextUrl.pathname}`, { requestId });
      return NextResponse.next();
    }
  } else {
    processedRequests.set(requestId, 1);
    
    // Clean up old request IDs (keep map size reasonable)
    if (processedRequests.size > 100) {
      const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
      keysToDelete.forEach(key => processedRequests.delete(key));
    }
  }
  
  const path = req.nextUrl.pathname;
  const isApi = isApiRoute(req);

  // @ts-ignore - Clerk type definitions might be outdated
  const userId = auth.userId;
  
  // Get session info (these might not exist in all Clerk versions)
  // @ts-ignore - Accessing potentially undefined properties
  const sessionId = auth.sessionId;
  // @ts-ignore - Accessing potentially undefined properties
  const orgId = auth.orgId;
  
  // For auth-related endpoints, log more details about auth state and headers
  const isAuthRoute = path.includes('/api/auth/');
  let authDetails: Record<string, any> = {
    requestId,
    isApi,
    isPublic: isPublicRoute(req),
    hasAuth: !!userId,
    sessionPresent: !!sessionId
  };
  
  // Add more detailed auth debugging for auth-related routes
  if (isAuthRoute) {
    // Check auth headers without exposing sensitive data
    const headers = inspectAuthHeaders(req);
    authDetails = {
      ...authDetails,
      headerKeys: Object.keys(headers),
      path,
      method: req.method,
      params: Object.fromEntries(req.nextUrl.searchParams.entries())
    };
    
    // Add session claim info if available
    try {
      if (auth && typeof auth === 'object' && 'sessionClaims' in auth) {
        const claims = (auth as any).sessionClaims;
        if (claims) {
          authDetails.sessionClaimsInfo = {
            exp: claims.exp,
            iat: claims.iat,
            hasJti: !!claims.jti
          };
        }
      }
    } catch (e) {
      // Ignore errors when accessing session claims
    }
  }
  
  // Log more detailed information for debugging
  logWithTimestamp('REQUEST', `Processing ${req.method} request for ${path}`, authDetails);

  // Special handling for auth endpoints
  if (path.includes('/api/auth/google-status') || path.includes('/api/auth/google-reconnect')) {
    logWithTimestamp('AUTH', `Processing Google ${path.includes('reconnect') ? 'reconnect' : 'status'} request`, {
      requestId,
      hasAuth: !!userId,
      sessionId: sessionId || 'none'
    });
    
    // Allow the request to proceed to the API handler
    // The handler will check auth status internally
    return NextResponse.next();
  }

  // Special handling for OAuth callback
  if (path.includes('/api/auth/google-callback')) {
    logWithTimestamp('OAUTH', `Processing Google OAuth callback`, {
      requestId,
      params: Object.fromEntries(req.nextUrl.searchParams.entries())
    });
  }

  // Special handling for critical API operations
  if (req.method === 'POST' && path.includes('/api/upload')) {
    logWithTimestamp('API', `Processing critical upload request`, {
      requestId,
      hasAuth: !!userId,
      sessionId: sessionId || 'none',
      path
    });
    
    // For upload requests, ensure we don't block them with middleware
    // The handler itself will validate authentication
    return NextResponse.next();
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    // Check if the user is not authenticated
    if (!userId) {
      logWithTimestamp('AUTH', `Unauthenticated request to protected route: ${path}`, {
        requestId,
        sessionId
      });

      // Handle API routes differently - return JSON instead of redirecting
      if (isApi) {
        logWithTimestamp('AUTH', 'Returning 401 for API route', {
          requestId,
          path
        });
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
      signInUrl.searchParams.set('redirect', path); // Add the redirect back parameter
      logWithTimestamp('AUTH', `Redirecting to sign-in: ${signInUrl.toString()}`, { requestId });
      return Response.redirect(signInUrl);
    }

    // Extract token expiration if available
    // @ts-ignore - Accessing potentially undefined properties
    const sessionClaims = auth.sessionClaims || {};
    const tokenExpiration = sessionClaims.exp 
      ? new Date(sessionClaims.exp * 1000).toISOString() 
      : 'unknown';

    logWithTimestamp('AUTH', `Authenticated request for ${path}`, { 
      requestId,
      userId,
      sessionId,
      tokenExpiration
    });
  } else {
    logWithTimestamp('AUTH', `Public route accessed: ${path}`, { requestId });
  }
}, {
  debug: process.env.NODE_ENV === 'development' // Only enable debug in development
});

// Stop the middleware from running on static files
export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
    '/(api|trpc)(.*)',
  ],
};