import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { disconnectGoogle } from '@/lib/googleOAuthManager';

/**
 * POST /api/auth/google-disconnect - Disconnect Google account
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('POST', 'auth/google-disconnect');
    log('auth', 'info', 'POST /api/auth/google-disconnect called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        log('auth', 'info', 'Disconnecting Google account for user', { requestId, userId });
        
        try {
            // Disconnect Google account
            await disconnectGoogle(userId);
            
            log('auth', 'info', 'Successfully disconnected Google account', { requestId, userId });
            
            return NextResponse.json({
                success: true,
                message: 'Successfully disconnected Google Drive'
            });
        } catch (error) {
            log('auth', 'error', 'Error disconnecting Google account', { 
                requestId, 
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            // Will be caught by withErrorHandling
            throw error;
        }
    }, requestId);
}

export const dynamic = 'force-dynamic'; 