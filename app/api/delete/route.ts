import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import * as DeleteHandlers from '@/app/api-handlers/delete';

/**
 * DELETE /api/delete - Handle item deletion
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('DELETE', 'delete');
    log('delete', 'info', 'DELETE /api/delete called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // Call the existing delete handler
        return DeleteHandlers.deleteItem(request);
    }, requestId);
}

export const dynamic = 'force-dynamic'; 