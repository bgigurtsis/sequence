import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/status - API status check
 * 
 * This endpoint returns basic information about the API status
 * and can be used for health checking or monitoring.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'status');
    log('status', 'info', 'GET /api/status called', { requestId, url: request.url });
    
    // Check if auth service is available
    let authStatus = 'unknown';
    try {
        const authResult = await auth();
        authStatus = 'available';
    } catch (error) {
        authStatus = 'error';
        log('status', 'error', 'Error checking auth status', { 
            requestId, 
            error: error instanceof Error ? error.message : String(error) 
        });
    }
    
    // Build the status response
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        services: {
            auth: authStatus
        },
        request: {
            id: requestId,
            method: request.method,
            path: new URL(request.url).pathname
        }
    };
    
    return NextResponse.json(status);
}

export const dynamic = 'force-dynamic'; 