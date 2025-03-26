import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth, tryRefreshSession } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import * as UploadHandlers from '@/app/api-handlers/upload';

/**
 * POST /api/upload/form - Handle form-based file upload
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('POST', 'upload/form');
    log('upload', 'info', 'POST /api/upload/form called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // For upload routes, try to refresh the session token to ensure it's fresh
        await tryRefreshSession(requestId);
        
        // Call the existing upload form handler
        return UploadHandlers.uploadForm(request);
    }, requestId);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for large file uploads 