// app/api-handlers/delete.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getUserGoogleAuthClient } from '@/lib/googleOAuthManager';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';

/**
 * Helper to find a folder in Google Drive
 */
async function findFolder(drive: any, name: string, parentId?: string, requestId?: string): Promise<string | null> {
    log('delete', 'info', `Looking for folder`, { 
        requestId,
        folderName: name,
        parentId: parentId || 'root'
    });

    try {
        const query = parentId
            ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
            : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (res.data.files && res.data.files.length > 0) {
            log('delete', 'info', `Found folder`, { 
                requestId,
                folderName: name,
                folderId: res.data.files[0].id
            });
            return res.data.files[0].id;
        }

        log('delete', 'info', `Folder not found`, { 
            requestId,
            folderName: name
        });
        return null;
    } catch (error) {
        log('delete', 'error', `Error looking for folder`, { 
            requestId,
            folderName: name,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

/**
 * Handle delete requests
 */
export async function deleteItem(request: NextRequest) {
    const requestId = generateRequestId('DELETE', 'delete');
    log('delete', 'info', 'Delete API called', { requestId });

    try {
        // Use requireAuth which will throw a 401 response if not authenticated
        const userId = await requireAuth(requestId);
        
        log('delete', 'info', 'User authenticated', { requestId, userId });

        // Get request data
        const data = await request.json();
        log('delete', 'info', 'Delete request data', { 
            requestId,
            ...data,
            type: data.type
        });

        const { type, performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId, recordingTitle } = data;

        // Initialize Google Drive API with user credentials
        log('delete', 'info', 'Initializing Google Drive API', { requestId, userId });
        const oauth2Client = await getUserGoogleAuthClient(userId);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Find root folder - using StageVault Recordings
        const rootFolderId = await findFolder(drive, "StageVault Recordings", undefined, requestId);
        if (!rootFolderId) {
            log('delete', 'info', 'Root folder not found, nothing to delete', { requestId });
            return NextResponse.json({ success: true, message: 'No files found to delete' });
        }

        // Handle different delete types
        switch (type) {
            case 'performance': {
                // Find and delete performance folder
                log('delete', 'info', 'Looking for performance folder', { 
                    requestId, 
                    performanceTitle
                });
                const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId, requestId);

                if (!performanceFolderId) {
                    log('delete', 'info', 'Performance folder not found', { requestId });
                    return NextResponse.json({ success: true, message: 'No files found to delete' });
                }

                log('delete', 'info', 'Deleting performance folder', { 
                    requestId, 
                    performanceTitle, 
                    performanceFolderId
                });
                await drive.files.delete({
                    fileId: performanceFolderId,
                });

                log('delete', 'info', 'Performance folder deleted successfully', { requestId });
                break;
            }

            case 'rehearsal': {
                // Find performance folder
                log('delete', 'info', 'Looking for performance folder', { 
                    requestId, 
                    performanceTitle
                });
                const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId, requestId);

                if (!performanceFolderId) {
                    log('delete', 'info', 'Performance folder not found', { requestId });
                    return NextResponse.json({ success: true, message: 'No files found to delete' });
                }

                // Find and delete rehearsal folder
                log('delete', 'info', 'Looking for rehearsal folder', { 
                    requestId, 
                    rehearsalTitle
                });
                const rehearsalFolderId = await findFolder(drive, rehearsalTitle, performanceFolderId, requestId);

                if (!rehearsalFolderId) {
                    log('delete', 'info', 'Rehearsal folder not found', { requestId });
                    return NextResponse.json({ success: true, message: 'No files found to delete' });
                }

                log('delete', 'info', 'Deleting rehearsal folder', { 
                    requestId, 
                    rehearsalTitle, 
                    rehearsalFolderId
                });
                await drive.files.delete({
                    fileId: rehearsalFolderId,
                });

                log('delete', 'info', 'Rehearsal folder deleted successfully', { requestId });
                break;
            }

            case 'recording': {
                // Find performance folder
                log('delete', 'info', 'Looking for performance folder', { 
                    requestId, 
                    performanceTitle
                });
                const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId, requestId);

                if (!performanceFolderId) {
                    log('delete', 'info', 'Performance folder not found', { requestId });
                    return NextResponse.json({ success: true, message: 'No files found to delete' });
                }

                // Find rehearsal folder
                const rehearsalFolderName = rehearsalTitle || 'Default Rehearsal';
                log('delete', 'info', 'Looking for rehearsal folder', { 
                    requestId, 
                    rehearsalFolderName
                });
                const rehearsalFolderId = await findFolder(drive, rehearsalFolderName, performanceFolderId, requestId);

                if (!rehearsalFolderId) {
                    log('delete', 'info', 'Rehearsal folder not found', { requestId });
                    return NextResponse.json({ success: true, message: 'No files found to delete' });
                }

                // Find recording files
                log('delete', 'info', 'Looking for recording files', { 
                    requestId, 
                    recordingTitle,
                    rehearsalFolderId
                });
                const res = await drive.files.list({
                    q: `'${rehearsalFolderId}' in parents and (name='${recordingTitle}.mp4' or name='${recordingTitle}_thumb.jpg') and trashed=false`,
                    fields: 'files(id, name)',
                    spaces: 'drive',
                });

                if (res.data.files && res.data.files.length > 0) {
                    log('delete', 'info', 'Found files to delete', { 
                        requestId, 
                        fileCount: res.data.files.length,
                        recordingTitle
                    });

                    for (const file of res.data.files) {
                        log('delete', 'info', 'Deleting file', { 
                            requestId, 
                            fileName: file.name,
                            fileId: file.id
                        });
                        await drive.files.delete({
                            fileId: file.id as string,
                        });
                    }

                    log('delete', 'info', 'Recording files deleted successfully', { requestId });
                } else {
                    log('delete', 'info', 'No files found for recording', { 
                        requestId, 
                        recordingTitle
                    });
                }

                break;
            }

            default:
                log('delete', 'error', 'Invalid delete type', { requestId, type });
                return NextResponse.json({ error: `Invalid delete type: ${type}` }, { status: 400 });
        }

        log('delete', 'info', 'Delete operation completed successfully', { 
            requestId, 
            type
        });
        
        return NextResponse.json({
            success: true,
            message: `${type} deleted successfully`,
        });
    } catch (error: any) {
        // Extract and format error details
        let errorMessage = 'Unknown error';
        let errorDetails = {};

        if (error instanceof Error) {
            errorMessage = error.message;
            errorDetails = {
                name: error.name,
                stack: error.stack,
            };

            // Check for Google API specific errors
            if (
                error.message.includes('invalid_grant') ||
                error.message.includes('token has been expired or revoked')
            ) {
                log('delete', 'error', 'Google Drive authentication error', { 
                    requestId, 
                    error: errorMessage
                });
                
                return NextResponse.json({
                    error: 'Google Drive connection error',
                    details: 'Your Google Drive connection has expired. Please reconnect in Settings.',
                    code: 'GOOGLE_AUTH_ERROR'
                }, { status: 401 });
            }
        }

        log('delete', 'error', 'Unhandled error in delete operation', { 
            requestId, 
            error: errorMessage,
            errorDetails
        });
        
        throw error;
    }
} 