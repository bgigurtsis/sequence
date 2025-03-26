// app/api-handlers/upload.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * Handle generic upload requests
 */
export async function upload(request: NextRequest) {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    try {
        // Parse request body
        const body = await request.json();
        const { videoData, metadata } = body;

        if (!videoData) {
            return NextResponse.json(
                { error: 'Missing video data' },
                { status: 400 }
            );
        }

        // Process video data (this is a simplified example)
        // In a real implementation, you'd need to decode the video data from base64 or fetch from URL
        const videoBlob = new Blob([]); // Placeholder

        // Upload to Google Drive - use userId directly instead of refreshToken
        const result = await googleDriveService.uploadFile(
            userId,
            videoBlob,
            {
                ...metadata,
                userId
            }
        );

        return NextResponse.json({
            success: true,
            fileId: result.fileId,
            fileName: result.fileName
        });
    } catch (error: any) {
        throw error;
    }
}

/**
 * Handle form-based uploads with multipart/form-data
 */
export async function uploadForm(request: NextRequest) {
    try {
        // Enhanced logging with timestamp
        const timestamp = new Date().toISOString();
        const logPrefix = `[${timestamp}][Upload]`;
        
        console.log(`${logPrefix} Processing form upload request`);
        
        // First validate authentication
        const authResult = await auth();
        const userId = authResult.userId;
        const sessionId = authResult.sessionId;

        // Handle authentication issues more gracefully
        if (!sessionId) {
            console.log(`${logPrefix} No session found, authentication required`);
            return NextResponse.json(
                { 
                    error: 'Authentication required',
                    code: 'NO_SESSION',
                    message: 'Your session was not found. Please sign in again.'
                },
                { status: 401 }
            );
        }

        if (!userId) {
            console.log(`${logPrefix} Session exists (${sessionId}) but no userId, expired session`);
            return NextResponse.json(
                { 
                    error: 'Session expired',
                    code: 'SESSION_EXPIRED',
                    message: 'Your session has expired. Please refresh and try again.'
                },
                { 
                    status: 401,
                    headers: {
                        'X-Session-Status': 'expired',
                        'X-Session-Id': sessionId,
                        'X-Refresh-Required': 'true'
                    }
                }
            );
        }

        console.log(`${logPrefix} User authenticated: ${userId}`);
        
        // Manually refresh session to ensure it won't expire during upload
        try {
            console.log(`${logPrefix} Refreshing session before upload for user: ${userId}`);
            
            // Use the getToken function from auth to trigger a session refresh
            const { getToken } = authResult;
            
            if (getToken) {
                // Retrieving a token refreshes the session
                await getToken();
                console.log(`${logPrefix} Session refreshed before upload`);
            } else {
                console.log(`${logPrefix} getToken function not available, skipping refresh`);
            }
        } catch (refreshError) {
            console.warn(`${logPrefix} Session refresh warning:`, refreshError);
            // Continue with upload even if refresh fails - we'll handle auth errors later
        }

        // Get form data
        const formData = await request.formData();
        const recordingId = formData.get('recordingId') as string;
        const performanceId = formData.get('performanceId') as string;
        const performanceTitle = formData.get('performanceTitle') as string;
        const videoBlob = formData.get('video') as Blob;
        const thumbnailBlob = formData.get('thumbnail') as Blob | null;
        
        // Get metadata from form data - handle both string and direct properties
        let metadata: Record<string, any> = {};
        const metadataString = formData.get('metadataString') as string;
        
        if (metadataString) {
            try {
                metadata = JSON.parse(metadataString);
            } catch (error) {
                console.error(`${logPrefix} Failed to parse metadata JSON:`, error);
                return NextResponse.json(
                    { 
                        error: 'Invalid metadata format',
                        code: 'INVALID_METADATA',
                        message: 'The metadata for this recording could not be processed.'
                    },
                    { status: 400 }
                );
            }
        } else {
            // Collect individual metadata fields if not provided as JSON
            const fields = ['recordingTitle', 'rehearsalId', 'rehearsalTitle', 'time', 'performers', 'notes', 'tags'];
            fields.forEach(field => {
                const value = formData.get(field);
                if (value) {
                    metadata[field] = value;
                }
            });
        }

        // Validate required fields
        if (!videoBlob) {
            console.error(`${logPrefix} Missing video blob in upload request`);
            return NextResponse.json(
                { 
                    error: 'Missing video data',
                    code: 'MISSING_VIDEO',
                    message: 'No video data was received for upload.'
                },
                { status: 400 }
            );
        }
        
        if (!performanceId) {
            console.error(`${logPrefix} Missing performanceId in upload request`);
            return NextResponse.json(
                { 
                    error: 'Missing performance ID',
                    code: 'MISSING_PERFORMANCE_ID',
                    message: 'No performance ID was provided for this recording.'
                },
                { status: 400 }
            );
        }

        // Get Google token with enhanced error handling
        try {
            console.log(`${logPrefix} Retrieving Google OAuth token for user: ${userId}`);
            
            // Import the token manager here to avoid circular dependencies
            const { getGoogleOAuthToken } = await import('@/lib/clerkTokenManager');
            
            // Call the token manager with proper parameters
            const tokenResult = await getGoogleOAuthToken(userId);
            const accessToken = tokenResult.token;
            
            // Log additional context for debugging but don't pass to function
            console.log(`${logPrefix} Token retrieval context: upload_form, operation: video_upload`);
            
            if (!accessToken) {
                console.error(`${logPrefix} No Google token available for user: ${userId}`);
                return NextResponse.json(
                    { 
                        error: 'Google Drive not connected',
                        code: 'NO_GOOGLE_CONNECTION',
                        message: 'Your Google Drive account is not connected. Please connect your Google account in settings.'
                    },
                    { status: 400 }
                );
            }

            console.log(`${logPrefix} Successfully obtained token, proceeding with upload`);
            
            // Create complete metadata for the upload
            const completeMetadata = {
                ...metadata,
                recordingId: recordingId || `rec_${Date.now()}`,
                performanceId,
                performanceTitle: performanceTitle || 'Untitled Performance',
                userId,
                uploadTime: new Date().toISOString()
            };

            // Upload to Google Drive using the token from Clerk's wallet
            console.log(`${logPrefix} Starting Google Drive upload for recording: ${completeMetadata.recordingId}`);
            const result = await googleDriveService.uploadFile(
                userId, // Now we pass userId instead of token directly
                videoBlob,
                completeMetadata,
                thumbnailBlob || undefined
            );

            console.log(`${logPrefix} Upload successful: ${result.fileId}`);
            return NextResponse.json({
                success: true,
                fileId: result.fileId,
                fileName: result.fileName,
                thumbnailId: result.thumbnailId,
                webViewLink: result.webViewLink
            });
        } catch (uploadError: any) {
            console.error(`${logPrefix} Error during upload:`, uploadError);
            
            // Detailed error handling based on different error types
            if (uploadError.message?.includes('token')) {
                return NextResponse.json(
                    { 
                        error: 'Authentication token error',
                        code: 'TOKEN_ERROR',
                        message: 'Your Google account authentication has expired. Please reconnect your Google account in settings.'
                    },
                    { status: 401 }
                );
            } 
            else if (uploadError.message?.includes('quota') || uploadError.message?.includes('exceeded')) {
                return NextResponse.json(
                    { 
                        error: 'Google Drive quota exceeded',
                        code: 'QUOTA_EXCEEDED',
                        message: 'Your Google Drive storage quota has been exceeded. Please free up some space or upgrade your Google account.'
                    },
                    { status: 403 }
                );
            }
            else if (uploadError.message?.includes('permission') || uploadError.message?.includes('access')) {
                return NextResponse.json(
                    { 
                        error: 'Google Drive permission error',
                        code: 'PERMISSION_DENIED',
                        message: 'The application does not have permission to upload to your Google Drive. Please reconnect your Google account with the correct permissions.'
                    },
                    { status: 403 }
                );
            }
            else if (uploadError.message?.includes('network') || uploadError.message?.includes('connection')) {
                return NextResponse.json(
                    { 
                        error: 'Network error',
                        code: 'NETWORK_ERROR',
                        message: 'There was a network problem during upload. Please check your internet connection and try again.'
                    },
                    { status: 503 }
                );
            }
            
            // Generic error with original message for debugging
            return NextResponse.json(
                { 
                    error: 'Upload failed',
                    code: 'UPLOAD_ERROR',
                    message: 'The upload to Google Drive failed. Please try again later.',
                    details: uploadError.message || 'Unknown error'
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error(`[${new Date().toISOString()}][Upload] Unexpected error:`, error);
        return NextResponse.json(
            { 
                error: 'Upload failed',
                code: 'SERVER_ERROR',
                message: 'An unexpected error occurred during upload. Please try again later.',
                details: error.message || 'Unknown error'
            },
            { status: 500 }
        );
    }
} 