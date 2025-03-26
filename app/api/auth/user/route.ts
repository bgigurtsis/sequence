import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';
import { withErrorHandling } from '@/lib/server/apiUtils';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/auth/user - Get user details
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'auth/user');
    log('auth', 'info', 'GET /api/auth/user called', { requestId, url: request.url });
    
    return withErrorHandling(async () => {
        // This will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        log('auth', 'info', 'Getting user details', { requestId, userId });
        
        try {
            // Get user from Clerk
            const user = await clerkClient.users.getUser(userId);
            
            // Return user details (filter sensitive information)
            return NextResponse.json({
                id: user.id,
                email: user.emailAddresses?.[0]?.emailAddress,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                imageUrl: user.imageUrl,
                lastSignInAt: user.lastSignInAt,
                createdAt: user.createdAt
            });
        } catch (error) {
            log('auth', 'error', 'Error fetching user details', { 
                requestId, 
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
            
            throw error; // Will be caught by withErrorHandling
        }
    }, requestId);
}

export const dynamic = 'force-dynamic'; 