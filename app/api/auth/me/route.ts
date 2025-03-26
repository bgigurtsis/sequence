import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { isGoogleConnected } from '@/lib/googleOAuthManager';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * GET /api/auth/me - Get current user info and Google Drive connection status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/me');
    log('auth', 'info', 'GET /api/auth/me called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        log('auth', 'info', `User authenticated: ${userId}`, { requestId });
        
        // Check Google connection status
        const isConnected = await isGoogleConnected(userId);
        log('auth', 'info', `Google connection status: ${isConnected}`, { requestId });
        
        // Base response
        const response = {
            authenticated: true,
            userId: userId,
            connected: isConnected,
            message: isConnected
                ? 'User has connected Google Drive'
                : 'User has not connected Google Drive'
        };
        
        // If connected, also check the Drive connection
        if (isConnected) {
            try {
                log('auth', 'info', 'Checking Google Drive connection', { requestId });
                const driveConnected = await googleDriveService.checkConnection(userId);
                log('auth', 'info', `Drive connection check result: ${driveConnected}`, { requestId });
                
                return NextResponse.json({
                    ...response,
                    connected: driveConnected,
                    message: driveConnected ? 'Connected to Google Drive' : 'Google Drive connection failed'
                });
            } catch (driveError) {
                log('auth', 'error', 'Error checking Drive connection', { 
                    requestId,
                    error: driveError instanceof Error ? driveError.message : String(driveError)
                });
                
                return NextResponse.json({
                    ...response,
                    connected: false,
                    message: driveError instanceof Error ? driveError.message : 'Error checking Google Drive connection'
                });
            }
        }
        
        return NextResponse.json(response);
    }, requestId);
}

export const dynamic = 'force-dynamic'; 