// app/api-handlers/upload.ts
import { NextRequest, NextResponse } from 'next/server';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth, tryRefreshSession } from '@/lib/server/auth';

/**
 * Handle generic upload requests
 */
export async function upload(request: NextRequest) {
    const requestId = generateRequestId('POST', 'upload');
    log('upload', 'info', 'Processing upload request', { requestId });
    
    try {
        // Use requireAuth which will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // Ensure session token is fresh
        await tryRefreshSession(requestId);
        
        log('upload', 'info', 'User authenticated', { requestId, userId });
        
        // Parse request body
        const body = await request.json();
        const { videoData, metadata } = body;

        if (!videoData) {
            log('upload', 'error', 'Missing video data', { requestId });
            return NextResponse.json(
                { error: 'Missing video data' },
                { status: 400 }
            );
        }

        log('upload', 'info', 'Processing video data', { 
            requestId,
            hasMetadata: !!metadata,
            metadataKeys: metadata ? Object.keys(metadata) : []
        });
        
        // Process video data (this is a simplified example)
        // In a real implementation, you'd need to decode the video data from base64 or fetch from URL
        const videoBlob = new Blob([]); // Placeholder

        // Upload to Google Drive using userId directly
        log('upload', 'info', 'Uploading to Google Drive', { requestId });
        const result = await googleDriveService.uploadFile(
            userId,
            videoBlob,
            {
                ...metadata,
                userId
            }
        );

        log('upload', 'info', 'Upload completed successfully', {
            requestId,
            fileId: result.fileId,
            fileName: result.fileName
        });
        
        return NextResponse.json({
            success: true,
            fileId: result.fileId,
            fileName: result.fileName
        });
    } catch (error: any) {
        // Don't need to handle errors here, they will be caught by the API route wrapper
        log('upload', 'error', 'Upload failed', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

/**
 * Handle form-based uploads with multipart/form-data
 */
export async function uploadForm(request: NextRequest) {
    const requestId = generateRequestId('POST', 'upload/form');
    log('upload', 'info', 'Processing form upload request', { requestId });
    
    try {
        // Use requireAuth which will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        // Ensure session token is fresh
        await tryRefreshSession(requestId);
        
        log('upload', 'info', 'User authenticated for form upload', { requestId, userId });

        // Get form data
        const formData = await request.formData();
        
        // Log all keys in the FormData (excluding actual file content)
        const formDataKeys = Array.from(formData.keys());
        log('upload', 'debug', 'Form data keys received', {
            requestId,
            formDataKeys,
            contentTypes: {
                video: formData.get('video') instanceof Blob ? (formData.get('video') as Blob).type : 'not-a-blob',
                thumbnail: formData.get('thumbnail') instanceof Blob ? (formData.get('thumbnail') as Blob).type : 'not-a-blob'
            }
        });
        
        // Log values of non-file fields for debugging
        const formDataValues: Record<string, any> = {};
        formDataKeys.forEach(key => {
            const value = formData.get(key);
            if (!(value instanceof Blob) && value !== null) {
                formDataValues[key] = value;
            } else if (value instanceof Blob) {
                formDataValues[key] = {
                    type: value.type,
                    size: value.size,
                    isBlob: true
                };
            }
        });
        
        log('upload', 'debug', 'Form data values (non-file)', {
            requestId,
            formDataValues
        });
        
        const recordingId = formData.get('recordingId') as string;
        const performanceId = formData.get('performanceId') as string;
        const performanceTitle = formData.get('performanceTitle') as string;
        const videoBlob = formData.get('video') as Blob;
        const thumbnailBlob = formData.get('thumbnail') as Blob | null;
        
        log('upload', 'info', 'Form data extracted', {
            requestId,
            hasVideo: !!videoBlob,
            videoSize: videoBlob ? videoBlob.size : 0,
            videoType: videoBlob ? videoBlob.type : 'none',
            hasThumbnail: !!thumbnailBlob,
            thumbnailSize: thumbnailBlob ? thumbnailBlob.size : 0,
            recordingId,
            performanceId
        });
        
        // Get metadata from form data - handle both string and direct properties
        let metadata: Record<string, any> = {};
        const metadataString = formData.get('metadataString') as string;
        
        if (metadataString) {
            try {
                metadata = JSON.parse(metadataString);
                log('upload', 'info', 'Parsed metadata from JSON string', {
                    requestId,
                    metadataKeys: Object.keys(metadata),
                    metadataContent: metadata // Log full metadata content
                });
            } catch (error) {
                log('upload', 'error', 'Failed to parse metadata JSON', {
                    requestId,
                    error: error instanceof Error ? error.message : String(error),
                    metadataString: metadataString // Log the raw string that failed to parse
                });
                
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
            
            log('upload', 'info', 'Collected metadata from individual fields', {
                requestId,
                metadataKeys: Object.keys(metadata),
                metadataContent: metadata // Log full metadata content
            });
        }

        // Validate required fields
        if (!videoBlob) {
            log('upload', 'error', 'Missing video blob in upload request', { requestId });
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
            log('upload', 'error', 'Missing performanceId in upload request', { requestId });
            return NextResponse.json(
                { 
                    error: 'Missing performance ID',
                    code: 'MISSING_PERFORMANCE_ID',
                    message: 'No performance ID was provided for this recording.'
                },
                { status: 400 }
            );
        }

        try {
            log('upload', 'info', 'Starting Google Drive upload', {
                requestId,
                recordingId: recordingId || 'new',
                performanceId
            });
            
            // Create complete metadata for the upload
            const completeMetadata = {
                ...metadata,
                recordingId: recordingId || `rec_${Date.now()}`,
                performanceId,
                performanceTitle: performanceTitle || 'Untitled Performance',
                userId,
                uploadTime: new Date().toISOString()
            };
            
            // Log the parameters being passed to GoogleDriveService.uploadFile
            log('upload', 'debug', 'Calling GoogleDriveService.uploadFile with parameters', {
                requestId,
                userId,
                videoBlobSize: videoBlob.size,
                videoBlobType: videoBlob.type,
                thumbnailExists: !!thumbnailBlob,
                thumbnailBlobSize: thumbnailBlob ? thumbnailBlob.size : 0,
                thumbnailBlobType: thumbnailBlob ? thumbnailBlob.type : 'none',
                completeMetadata
            });

            // Upload to Google Drive using the userId
            const result = await googleDriveService.uploadFile(
                userId,
                videoBlob,
                completeMetadata,
                thumbnailBlob || undefined
            );
            
            // Log detailed result information
            log('upload', 'debug', 'Google Drive upload result details', {
                requestId,
                resultSuccess: result.success,
                resultFileId: result.fileId,
                resultFileName: result.fileName,
                resultThumbnailId: result.thumbnailId,
                hasWebViewLink: !!result.webViewLink
            });

            log('upload', 'info', 'Upload successful', {
                requestId,
                fileId: result.fileId,
                fileName: result.fileName,
                thumbnailId: result.thumbnailId
            });
            
            return NextResponse.json({
                success: true,
                fileId: result.fileId,
                fileName: result.fileName,
                thumbnailId: result.thumbnailId,
                webViewLink: result.webViewLink
            });
        } catch (uploadError: any) {
            log('upload', 'error', 'Error during upload', {
                requestId,
                error: uploadError instanceof Error ? uploadError.message : String(uploadError),
                stack: uploadError instanceof Error ? uploadError.stack : undefined
            });
            
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
        log('upload', 'error', 'Unexpected error in form upload', {
            requestId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        
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