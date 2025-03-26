import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';

/**
 * POST /api/auth/session - Create a new session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('POST', 'auth/session');
    log('auth', 'info', 'POST /api/auth/session called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // Create a session
        // In a real implementation, this would create a session in the database
        log('auth', 'info', 'Creating session for user', { requestId, userId });
        
        return NextResponse.json({
            success: true,
            sessionId: `session-${Date.now()}-${userId.substring(0, 8)}`,
            userId
        });
    }, requestId);
}

export const dynamic = 'force-dynamic'; 