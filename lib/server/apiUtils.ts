import { NextRequest, NextResponse } from 'next/server';
import { log } from '../logging';

/**
 * Wrapper for API route handlers to provide consistent error handling
 * @param handler The API route handler function
 * @param requestId A unique identifier for the request
 */
export async function withErrorHandling(
    handler: () => Promise<NextResponse>,
    requestId: string
): Promise<NextResponse> {
    try {
        const response = await handler();
        
        // Ensure content type is set
        if (!response.headers.has('Content-Type')) {
            response.headers.set('Content-Type', 'application/json');
        }
        
        return response;
    } catch (error) {
        // Handle NextResponse errors (thrown by requireAuth, etc.)
        if (error instanceof NextResponse) {
            // Add any headers we need
            if (!error.headers.has('Content-Type')) {
                error.headers.set('Content-Type', 'application/json');
            }
            return error;
        }
        
        // Log all other errors
        log('api', 'error', 'Unhandled error in API route', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            requestId
        });
        
        // Handle specific error types
        if (error instanceof Error && error.message?.includes('token has been expired or revoked')) {
            return NextResponse.json(
                { error: 'Google Drive connection error', details: 'Your Google Drive connection has expired. Please reconnect in Settings.' },
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        // Default error response
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
                details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
            },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * Extract path parameters from a request URL path
 * @param request The NextRequest object
 * @param routePath The route path pattern (e.g., /api/items/:id)
 * @returns An object with the extracted parameters
 */
export function extractPathParams(request: NextRequest, routePath: string): Record<string, string> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const routeParts = routePath.split('/').filter(Boolean);
    
    const params: Record<string, string> = {};
    
    for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
            const paramName = routeParts[i].substring(1);
            params[paramName] = pathParts[i] || '';
        }
    }
    
    return params;
} 