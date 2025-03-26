import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * GET /api/auth/google-auth-url - Generate Google OAuth URL
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/google-auth-url');
    log('auth', 'info', 'GET /api/auth/google-auth-url called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        log('auth', 'info', 'Generating auth URL for user', { requestId, userId });
        
        // Generate a state parameter to prevent CSRF attacks
        // Include the userId so we know who to associate the tokens with
        const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
        log('auth', 'info', 'Generated state parameter', { requestId, userId, state });
        
        try {
            // Generate the OAuth URL
            const authUrl = googleDriveService.generateAuthUrl();
            
            // Add state parameter to the URL
            const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;
            log('auth', 'info', 'Generated auth URL', { requestId, urlLength: urlWithState.length });
            
            return NextResponse.json({ url: urlWithState });
        } catch (error) {
            log('auth', 'error', 'Error generating auth URL', { 
                requestId, 
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw error; // Will be caught by withErrorHandling
        }
    }, requestId);
}

export const dynamic = 'force-dynamic'; 