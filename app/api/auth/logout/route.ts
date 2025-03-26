import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';

/**
 * POST /api/auth/logout - Log out the user
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('POST', 'auth/logout');
    log('auth', 'info', 'POST /api/auth/logout called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // Note: This endpoint doesn't actually log the user out
        // That's handled by Clerk's frontend components/SDK
        // This is just a server-side endpoint to acknowledge the logout
        log('auth', 'info', 'Processing logout request', { requestId, userId });
        
        return NextResponse.json({
            success: true,
            message: 'Logged out successfully'
        });
    }, requestId);
}

export const dynamic = 'force-dynamic'; 