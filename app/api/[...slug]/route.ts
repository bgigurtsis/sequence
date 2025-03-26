import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Import all handlers
import * as AuthHandlers from '@/app/api-handlers/auth';
import * as UploadHandlers from '@/app/api-handlers/upload';
import * as DeleteHandlers from '@/app/api-handlers/delete';

// Track requests to prevent duplicate processing
const processedRequests = new Map<string, number>();

// Add detailed logging helper with log levels
function logWithTimestamp(type: string, message: string, data?: any) {
    // Only log errors and warnings in production, all logs in development
    const isProd = process.env.NODE_ENV === 'production';
    const logLevel = type === 'ERROR' ? 'error' : 
                   type === 'WARNING' ? 'warn' : 'info';
    
    // Skip verbose logs in production
    if (isProd && logLevel === 'info' && !message.includes('error') && !message.includes('fail')) {
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    // Simplify data logging in production
    let logData = data;
    if (isProd && data) {
        // For requests, don't log full headers and bodies
        if (message.includes('Request') && typeof data === 'object') {
            logData = { url: data.url };
        } else if (typeof data === 'object' && data !== null) {
            // For other data, only include essential properties
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
        console.error(`[${timestamp}][API][Router][${type}] ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    } else if (logLevel === 'warn') {
        console.warn(`[${timestamp}][API][Router][${type}] ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    } else {
        console.log(`[${timestamp}][API][Router][${type}] ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    }
}

// Generate a unique request ID for tracking
function generateRequestId(req: NextRequest, slug: string): string {
    const timestamp = Date.now();
    return `${req.method}-${slug}-${timestamp}`;
}

// Generate cache key for auth results - prevents multiple auth calls
let authCache: { 
  userId: string | null; 
  sessionId: string | null; 
  getToken?: Function; 
  timestamp: number 
} | null = null;
const AUTH_CACHE_TTL = 2000; // 2 seconds

// Get auth result with caching to prevent redundant auth() calls
async function getCachedAuth() {
    const now = Date.now();
    
    // Use cached auth if recent enough
    if (authCache && (now - authCache.timestamp < AUTH_CACHE_TTL)) {
        return {
            userId: authCache.userId,
            sessionId: authCache.sessionId,
            getToken: authCache.getToken
        };
    }
    
    // Otherwise get fresh auth
    const authResult = await auth();
    authCache = {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        getToken: authResult.getToken,
        timestamp: now
    };
    
    return {
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        getToken: authResult.getToken
    };
}

interface RouteHandler {
    GET?: (request: NextRequest, params?: any) => Promise<NextResponse>;
    POST?: (request: NextRequest, params?: any) => Promise<NextResponse>;
    PUT?: (request: NextRequest, params?: any) => Promise<NextResponse>;
    DELETE?: (request: NextRequest, params?: any) => Promise<NextResponse>;
    PATCH?: (request: NextRequest, params?: any) => Promise<NextResponse>;
    requiresAuth?: boolean;
    config?: {
        maxDuration?: number;
        runtime?: 'edge' | 'nodejs';
    };
}

// Route mapping
const routes: Record<string, RouteHandler> = {
    // Auth routes
    'auth/me': {
        GET: AuthHandlers.getMe,
        requiresAuth: true,
        config: {
            runtime: 'edge'
        }
    },
    'auth/google-status': {
        GET: AuthHandlers.getGoogleStatus,
        requiresAuth: true
    },
    'auth/google-auth-url': {
        GET: AuthHandlers.getGoogleAuthUrl,
        requiresAuth: true
    },
    'auth/google-disconnect': {
        POST: AuthHandlers.disconnectGoogle,
        requiresAuth: true
    },
    'auth/session': {
        POST: AuthHandlers.createSession,
        requiresAuth: true
    },
    'auth/user': {
        GET: AuthHandlers.getUser,
        requiresAuth: true
    },
    'auth/logout': {
        POST: AuthHandlers.logout,
        requiresAuth: true
    },
    'auth/refresh-session': {
        GET: AuthHandlers.refreshSession,
        requiresAuth: false,
        config: {
            runtime: 'edge'
        }
    },

    // Upload routes
    'upload': {
        POST: UploadHandlers.upload,
        requiresAuth: true
    },
    'upload/form': {
        POST: UploadHandlers.uploadForm,
        requiresAuth: true,
        config: {
            maxDuration: 60 // 60 seconds for large uploads
        }
    },

    // Delete routes
    'delete': {
        DELETE: DeleteHandlers.deleteItem,
        requiresAuth: true
    }
};

// Helper to log requests
function logRequest(method: string, path: string, userId?: string | null, requestId?: string) {
    logWithTimestamp('REQUEST', `${method} ${path} ${userId ? `(User: ${userId})` : '(Not authenticated)'}`, { requestId });
}

// Add check for upload paths to trigger session refresh
function isUploadPath(slug: string[]): boolean {
  return (
    slug.length > 0 && 
    (slug[0] === "upload" || (slug[0] === "api" && slug[1] === "upload"))
  );
}

// Add a helper function to handle request parsing
async function parseRequest(request: NextRequest, params: { slug: string[] }): Promise<{
  slug: string[];
  method: string;
  auth: any;
  isUpload: boolean;
}> {
  const { slug } = params;
  const method = request.method;
  
  const isUpload = isUploadPath(slug);
  
  // Get auth with optional token retrieval for upload requests
  const auth = await getCachedAuth();
  
  return { slug, method, auth, isUpload };
}

// Error handling wrapper
async function handleRequest(
    request: NextRequest,
    method: string,
    handler: Function,
    requiresAuth: boolean,
    requestId: string,
    params?: any
) {
    try {
        // Only log basic request info in production
        if (process.env.NODE_ENV === 'development') {
            logWithTimestamp('HANDLER', `Processing ${method} request`, {
                url: request.url,
                requiresAuth,
                requestId
                // Don't log headers in production to reduce spam
            });
        } else {
            // Simplified logging in production
            logWithTimestamp('HANDLER', `Processing ${method} request for ${new URL(request.url).pathname}`, { requestId });
        }

        // Use cached auth to prevent redundant auth() calls
        const { userId, sessionId, getToken } = await getCachedAuth();
        
        // For upload routes, attempt to refresh the session
        const path = new URL(request.url).pathname;
        if (path.includes('/upload') && method === 'POST') {
            logWithTimestamp('AUTH', `Attempting to refresh session for upload request`, {
                requestId,
                userId,
                sessionId
            });
            
            // Use getToken to refresh the session if available
            if (getToken) {
                try {
                    await getToken();
                    logWithTimestamp('AUTH', `Successfully refreshed session for upload request`, {
                        requestId,
                        userId
                    });
                } catch (refreshError) {
                    logWithTimestamp('WARNING', `Failed to refresh session for upload, proceeding anyway`, {
                        requestId,
                        userId,
                        error: refreshError instanceof Error ? refreshError.message : String(refreshError)
                    });
                }
            }
        }

        // Only log auth result, not full auth details
        logWithTimestamp('AUTH', `Auth check result: ${userId ? 'Authenticated' : 'Not authenticated'}`, {
            userId,
            requestId
        });

        if (requiresAuth && !userId) {
            logWithTimestamp('AUTH', 'Auth required but user not authenticated', { requestId });
            const response = NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );

            // Ensure we're sending JSON content type
            response.headers.set('Content-Type', 'application/json');

            return response;
        }

        // Call the handler
        logWithTimestamp('HANDLER', `Calling handler for ${method}`, { requestId });
        const response = await handler(request, params);

        // Only log status code, not full response details
        logWithTimestamp('RESPONSE', `Handler response`, {
            status: response.status,
            requestId
        });

        // Ensure we're sending JSON content type
        response.headers.set('Content-Type', 'application/json');

        return response;
    } catch (error: any) {
        // Always log errors in detail
        logWithTimestamp('ERROR', `Error handling ${method} request:`, { error, requestId });

        // Handle specific error types
        if (error.message?.includes('token has been expired or revoked')) {
            const response = NextResponse.json(
                { error: 'Google Drive connection error', details: 'Your Google Drive connection has expired. Please reconnect in Settings.' },
                { status: 401 }
            );

            // Ensure we're sending JSON content type
            response.headers.set('Content-Type', 'application/json');

            return response;
        }

        // Default error handling
        const response = NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );

        // Ensure we're sending JSON content type
        response.headers.set('Content-Type', 'application/json');

        return response;
    }
}

// Main handler functions
export async function GET(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    
    // Generate a request ID to track duplicates
    const requestId = generateRequestId(request, slug);
    
    // Check if we've already processed this request
    if (processedRequests.has(requestId)) {
        const count = processedRequests.get(requestId) || 0;
        processedRequests.set(requestId, count + 1);
        
        // If we see it again, skip processing
        if (count > 0) {
            logWithTimestamp('DUPLICATE', `Skipping duplicate GET request: ${slug}`, { requestId, count: count + 1 });
            return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
        }
    } else {
        processedRequests.set(requestId, 1);
        
        // Clean up old requests
        if (processedRequests.size > 100) {
            const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => processedRequests.delete(key));
        }
    }

    logWithTimestamp('GET', `Request received for path: ${slug}`, {
        url: request.url,
        requestId
    });

    const { userId } = await getCachedAuth();

    logRequest('GET', slug, userId, requestId);

    const route = routes[slug];

    if (!route || !route.GET) {
        logWithTimestamp('GET', `Route not found: ${slug}`, { requestId });
        const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
        response.headers.set('Content-Type', 'application/json');
        return response;
    }

    logWithTimestamp('GET', `Route found for ${slug}, handling request`, { requestId });
    return handleRequest(request, 'GET', route.GET, route.requiresAuth || false, requestId);
}

export async function POST(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    
    // Generate a request ID to track duplicates
    const requestId = generateRequestId(request, slug);
    
    // Check if we've already processed this request
    if (processedRequests.has(requestId)) {
        const count = processedRequests.get(requestId) || 0;
        processedRequests.set(requestId, count + 1);
        
        // If we see it again, skip processing
        if (count > 0) {
            logWithTimestamp('DUPLICATE', `Skipping duplicate POST request: ${slug}`, { requestId, count: count + 1 });
            return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
        }
    } else {
        processedRequests.set(requestId, 1);
        
        // Clean up old requests
        if (processedRequests.size > 100) {
            const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => processedRequests.delete(key));
        }
    }

    logWithTimestamp('POST', `Request received for path: ${slug}`, {
        url: request.url,
        requestId
    });

    const { userId } = await getCachedAuth();

    logRequest('POST', slug, userId, requestId);

    const route = routes[slug];
    if (!route || !route.POST) {
        logWithTimestamp('POST', `Route not found: ${slug}`, { requestId });
        const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
        response.headers.set('Content-Type', 'application/json');
        return response;
    }

    return handleRequest(request, 'POST', route.POST, route.requiresAuth || false, requestId);
}

export async function DELETE(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    
    // Generate a request ID to track duplicates
    const requestId = generateRequestId(request, slug);
    
    // Check if we've already processed this request
    if (processedRequests.has(requestId)) {
        const count = processedRequests.get(requestId) || 0;
        processedRequests.set(requestId, count + 1);
        
        // If we see it again, skip processing
        if (count > 0) {
            logWithTimestamp('DUPLICATE', `Skipping duplicate DELETE request: ${slug}`, { requestId, count: count + 1 });
            return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
        }
    } else {
        processedRequests.set(requestId, 1);
        
        // Clean up old requests
        if (processedRequests.size > 100) {
            const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => processedRequests.delete(key));
        }
    }

    logWithTimestamp('DELETE', `Request received for path: ${slug}`, {
        url: request.url,
        requestId
    });

    const { userId } = await getCachedAuth();

    logRequest('DELETE', slug, userId, requestId);

    const route = routes[slug];
    if (!route || !route.DELETE) {
        logWithTimestamp('DELETE', `Route not found: ${slug}`, { requestId });
        const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
        response.headers.set('Content-Type', 'application/json');
        return response;
    }

    return handleRequest(request, 'DELETE', route.DELETE, route.requiresAuth || false, requestId);
}

export async function PUT(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    
    // Generate a request ID to track duplicates
    const requestId = generateRequestId(request, slug);
    
    // Check if we've already processed this request
    if (processedRequests.has(requestId)) {
        const count = processedRequests.get(requestId) || 0;
        processedRequests.set(requestId, count + 1);
        
        // If we see it again, skip processing
        if (count > 0) {
            logWithTimestamp('DUPLICATE', `Skipping duplicate PUT request: ${slug}`, { requestId, count: count + 1 });
            return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
        }
    } else {
        processedRequests.set(requestId, 1);
        
        // Clean up old requests
        if (processedRequests.size > 100) {
            const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => processedRequests.delete(key));
        }
    }

    logWithTimestamp('PUT', `Request received for path: ${slug}`, {
        url: request.url,
        requestId
    });

    const { userId } = await getCachedAuth();

    logRequest('PUT', slug, userId, requestId);

    const route = routes[slug];
    if (!route || !route.PUT) {
        logWithTimestamp('PUT', `Route not found: ${slug}`, { requestId });
        const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
        response.headers.set('Content-Type', 'application/json');
        return response;
    }

    return handleRequest(request, 'PUT', route.PUT, route.requiresAuth || false, requestId);
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    
    // Generate a request ID to track duplicates
    const requestId = generateRequestId(request, slug);
    
    // Check if we've already processed this request
    if (processedRequests.has(requestId)) {
        const count = processedRequests.get(requestId) || 0;
        processedRequests.set(requestId, count + 1);
        
        // If we see it again, skip processing
        if (count > 0) {
            logWithTimestamp('DUPLICATE', `Skipping duplicate PATCH request: ${slug}`, { requestId, count: count + 1 });
            return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
        }
    } else {
        processedRequests.set(requestId, 1);
        
        // Clean up old requests
        if (processedRequests.size > 100) {
            const keysToDelete = Array.from(processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => processedRequests.delete(key));
        }
    }

    logWithTimestamp('PATCH', `Request received for path: ${slug}`, {
        url: request.url,
        requestId
    });

    const { userId } = await getCachedAuth();

    logRequest('PATCH', slug, userId, requestId);

    const route = routes[slug];
    if (!route || !route.PATCH) {
        logWithTimestamp('PATCH', `Route not found: ${slug}`, { requestId });
        const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
        response.headers.set('Content-Type', 'application/json');
        return response;
    }

    return handleRequest(request, 'PATCH', route.PATCH, route.requiresAuth || false, requestId);
}

// Set configuration
export const dynamic = 'force-dynamic';

// Commenting out or removing this function fixes the build error
// export function generateMetadata({ params }: { params: { slug: string[] } }) {
//     const slug = params.slug.join('/');
//     const route = routes[slug];

//     return {
//         title: `API - ${slug}`,
//         config: route?.config || {}
//     };
// } 