import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Import all handlers
import * as AuthHandlers from '@/app/api-handlers/auth';
import * as UploadHandlers from '@/app/api-handlers/upload';
import * as DeleteHandlers from '@/app/api-handlers/delete';

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
    'auth/exchange-code': {
        POST: AuthHandlers.exchangeCode,
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
function logRequest(method: string, path: string, userId?: string | null) {
    console.log(`[${new Date().toISOString()}] ${method} ${path} ${userId ? `(User: ${userId})` : '(Not authenticated)'}`);
}

// Error handling wrapper
async function handleRequest(
    request: NextRequest,
    method: string,
    handler: Function,
    requiresAuth: boolean,
    params?: any
) {
    try {
        // For auth checking, we need to await it 
        const authResult = await auth();
        const userId = authResult.userId;

        if (requiresAuth && !userId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Call the handler
        return await handler(request, params);
    } catch (error: any) {
        console.error(`Error handling ${method} request:`, error);

        // Handle specific error types
        if (error.message?.includes('token has been expired or revoked')) {
            return NextResponse.json(
                { error: 'Google Drive connection error', details: 'Your Google Drive connection has expired. Please reconnect in Settings.' },
                { status: 401 }
            );
        }

        // Default error handling
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}

// Main handler functions
export async function GET(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const authResult = await auth();
    const userId = authResult.userId;

    logRequest('GET', slug, userId);

    const route = routes[slug];
    if (!route || !route.GET) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return handleRequest(request, 'GET', route.GET, route.requiresAuth || false);
}

export async function POST(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const authResult = await auth();
    const userId = authResult.userId;

    logRequest('POST', slug, userId);

    const route = routes[slug];
    if (!route || !route.POST) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return handleRequest(request, 'POST', route.POST, route.requiresAuth || false);
}

export async function DELETE(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const authResult = await auth();
    const userId = authResult.userId;

    logRequest('DELETE', slug, userId);

    const route = routes[slug];
    if (!route || !route.DELETE) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return handleRequest(request, 'DELETE', route.DELETE, route.requiresAuth || false);
}

export async function PUT(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const authResult = await auth();
    const userId = authResult.userId;

    logRequest('PUT', slug, userId);

    const route = routes[slug];
    if (!route || !route.PUT) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return handleRequest(request, 'PUT', route.PUT, route.requiresAuth || false);
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const authResult = await auth();
    const userId = authResult.userId;

    logRequest('PATCH', slug, userId);

    const route = routes[slug];
    if (!route || !route.PATCH) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return handleRequest(request, 'PATCH', route.PATCH, route.requiresAuth || false);
}

// Set configuration
export const dynamic = 'force-dynamic';

// Conditionally set maxDuration based on route
export function generateMetadata({ params }: { params: { slug: string[] } }) {
    const slug = params.slug.join('/');
    const route = routes[slug];

    return {
        title: `API - ${slug}`,
        config: route?.config || {}
    };
} 