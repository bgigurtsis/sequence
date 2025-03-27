// app/api-handlers/delete.ts
import { NextRequest, NextResponse } from 'next/server';
import { googleDriveService } from '@/lib/GoogleDriveService';
import { log, generateRequestId } from '@/lib/logging';
import { requireAuth } from '@/lib/server/auth';

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

        // Handle different delete types
        switch (type) {
            case 'performance': {
                log('delete', 'info', 'Deleting performance', { 
                    requestId, 
                    performanceId,
                    performanceTitle 
                });
                
                const success = await deletePerformance(userId, performanceTitle, requestId);
                
                if (success) {
                    log('delete', 'info', 'Performance deleted successfully', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Performance deleted successfully',
                    });
                } else {
                    log('delete', 'info', 'Performance not found or error deleting', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Performance not found or already deleted',
                    });
                }
            }

            case 'rehearsal': {
                log('delete', 'info', 'Deleting rehearsal', { 
                    requestId, 
                    performanceId,
                    performanceTitle,
                    rehearsalId,
                    rehearsalTitle 
                });
                
                const success = await deleteRehearsal(userId, performanceTitle, rehearsalTitle, requestId);
                
                if (success) {
                    log('delete', 'info', 'Rehearsal deleted successfully', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Rehearsal deleted successfully',
                    });
                } else {
                    log('delete', 'info', 'Rehearsal not found or error deleting', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Rehearsal not found or already deleted',
                    });
                }
            }

            case 'recording': {
                log('delete', 'info', 'Deleting recording', { 
                    requestId, 
                    performanceId,
                    performanceTitle,
                    rehearsalId,
                    rehearsalTitle,
                    recordingId,
                    recordingTitle
                });
                
                const success = await deleteRecording(userId, performanceTitle, rehearsalTitle, recordingTitle, requestId);
                
                if (success) {
                    log('delete', 'info', 'Recording deleted successfully', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Recording deleted successfully',
                    });
                } else {
                    log('delete', 'info', 'Recording not found or error deleting', { requestId });
                    return NextResponse.json({
                        success: true,
                        message: 'Recording not found or already deleted',
                    });
                }
            }

            default:
                log('delete', 'error', 'Invalid delete type', { requestId, type });
                return NextResponse.json({ error: `Invalid delete type: ${type}` }, { status: 400 });
        }
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
        }

        // Log the error
        log('delete', 'error', `Error processing delete request: ${errorMessage}`, {
            ...errorDetails,
            requestId: error.requestId || 'unknown'
        });

        // Return appropriate error response
        if (error.status === 401) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * Delete a performance folder
 */
async function deletePerformance(userId: string, performanceTitle: string, requestId: string): Promise<boolean> {
    try {
        // First, get the list of files to find the folder ID
        const files = await googleDriveService.listFiles(userId);
        const rootFolder = files.find(file => 
            file.name === 'StageVault Recordings' && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!rootFolder || !rootFolder.id) {
            log('delete', 'info', 'Root folder not found', { requestId });
            return false;
        }
        
        // Find the performance folder
        const performanceFolderList = await googleDriveService.listFiles(userId, rootFolder.id);
        const performanceFolder = performanceFolderList.find(file => 
            file.name === performanceTitle && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!performanceFolder || !performanceFolder.id) {
            log('delete', 'info', 'Performance folder not found', { requestId });
            return false;
        }
        
        // Delete the performance folder
        return await googleDriveService.deleteFile(userId, performanceFolder.id);
    } catch (error) {
        log('delete', 'error', 'Error deleting performance', { 
            requestId, 
            performanceTitle,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Delete a rehearsal folder
 */
async function deleteRehearsal(userId: string, performanceTitle: string, rehearsalTitle: string, requestId: string): Promise<boolean> {
    try {
        // First, get the list of files to find the root folder
        const files = await googleDriveService.listFiles(userId);
        const rootFolder = files.find(file => 
            file.name === 'StageVault Recordings' && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!rootFolder || !rootFolder.id) {
            log('delete', 'info', 'Root folder not found', { requestId });
            return false;
        }
        
        // Find the performance folder
        const performanceFolderList = await googleDriveService.listFiles(userId, rootFolder.id);
        const performanceFolder = performanceFolderList.find(file => 
            file.name === performanceTitle && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!performanceFolder || !performanceFolder.id) {
            log('delete', 'info', 'Performance folder not found', { requestId });
            return false;
        }
        
        // Find the rehearsal folder
        const rehearsalFolderList = await googleDriveService.listFiles(userId, performanceFolder.id);
        const rehearsalFolder = rehearsalFolderList.find(file => 
            file.name === rehearsalTitle && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!rehearsalFolder || !rehearsalFolder.id) {
            log('delete', 'info', 'Rehearsal folder not found', { requestId });
            return false;
        }
        
        // Delete the rehearsal folder
        return await googleDriveService.deleteFile(userId, rehearsalFolder.id);
    } catch (error) {
        log('delete', 'error', 'Error deleting rehearsal', { 
            requestId, 
            performanceTitle,
            rehearsalTitle,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
}

/**
 * Delete recording files
 */
async function deleteRecording(userId: string, performanceTitle: string, rehearsalTitle: string, recordingTitle: string, requestId: string): Promise<boolean> {
    try {
        // First, get the list of files to find the root folder
        const files = await googleDriveService.listFiles(userId);
        const rootFolder = files.find(file => 
            file.name === 'StageVault Recordings' && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!rootFolder || !rootFolder.id) {
            log('delete', 'info', 'Root folder not found', { requestId });
            return false;
        }
        
        // Find the performance folder
        const performanceFolderList = await googleDriveService.listFiles(userId, rootFolder.id);
        const performanceFolder = performanceFolderList.find(file => 
            file.name === performanceTitle && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!performanceFolder || !performanceFolder.id) {
            log('delete', 'info', 'Performance folder not found', { requestId });
            return false;
        }
        
        // Find the rehearsal folder
        const rehearsalFolderName = rehearsalTitle || 'Default Rehearsal';
        const rehearsalFolderList = await googleDriveService.listFiles(userId, performanceFolder.id);
        const rehearsalFolder = rehearsalFolderList.find(file => 
            file.name === rehearsalFolderName && 
            file.mimeType === 'application/vnd.google-apps.folder'
        );
        
        if (!rehearsalFolder || !rehearsalFolder.id) {
            log('delete', 'info', 'Rehearsal folder not found', { requestId });
            return false;
        }
        
        // Find recording files
        const recordingFilesList = await googleDriveService.listFiles(userId, rehearsalFolder.id);
        const recordingFiles = recordingFilesList.filter(file => 
            (file.name === `${recordingTitle}.mp4` || file.name === `${recordingTitle}_thumb.jpg`) && 
            file.mimeType !== 'application/vnd.google-apps.folder'
        );
        
        if (recordingFiles.length === 0) {
            log('delete', 'info', 'No recording files found', { 
                requestId,
                recordingTitle
            });
            return false;
        }
        
        // Delete each recording file
        let success = true;
        for (const file of recordingFiles) {
            if (file.id) {
                const result = await googleDriveService.deleteFile(userId, file.id);
                if (!result) {
                    success = false;
                }
            }
        }
        
        return success;
    } catch (error) {
        log('delete', 'error', 'Error deleting recording', { 
            requestId, 
            performanceTitle,
            rehearsalTitle,
            recordingTitle,
            error: error instanceof Error ? error.message : String(error)
        });
        return false;
    }
} 