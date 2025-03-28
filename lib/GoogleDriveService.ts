// lib/GoogleDriveService.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { 
    getUserGoogleAuthClient, 
    generateAuthUrl, 
    exchangeCodeForTokens 
} from './googleOAuthManager';
import { clerkClient } from '@clerk/nextjs/server';

// Types
interface FileUploadResult {
    success: boolean;
    fileId: string;
    fileName: string;
    thumbnailId?: string;
    thumbnailLink?: string;
    webViewLink?: string;
}

interface FolderInfo {
    id: string;
    name: string;
}

interface DriveMetadata {
    performanceId?: string;
    performanceTitle?: string;
    rehearsalId?: string;
    rehearsalTitle?: string;
    recordingId?: string;
    title?: string;
    description?: string;
    date?: string;
    time?: string;
    duration?: number;
    [key: string]: any;
}

interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
    createdTime?: string;
    modifiedTime?: string;
    size?: string;
    parents?: string[];
    appProperties?: Record<string, string>;
}

/**
 * GoogleDriveService - A centralized service for all Google Drive operations
 * 
 * This module handles:
 * - Authentication and token management
 * - Folder creation and management
 * - File uploads and downloads
 * - Metadata operations
 * - Error handling and logging
 * 
 * It combines functionality from both client and server services
 */
export class GoogleDriveService {
    private readonly ROOT_FOLDER_NAME = 'StageVault Recordings';

    /**
     * Check if the Google Drive connection is working
     * @param userId - The user's ID
     * @returns True if connection is working, false otherwise
     */
    async checkConnection(userId: string): Promise<boolean> {
        const checkId = Math.random().toString(36).substring(2, 8); // Unique ID for this check
        
        try {
            this.logOperation('start', `[${checkId}] Checking Google Drive connection`, { userId });

            // Create an OAuth client for this user
            // This will automatically get the token from Clerk's wallet
            const oauth2Client = await getUserGoogleAuthClient(userId);
            
            if (!oauth2Client) {
                this.logOperation('error', `[${checkId}] Failed to get OAuth client`, { 
                    userId,
                    reason: 'OAuth client creation failed - likely a token issue'
                });
                throw new Error('Failed to create Google OAuth client');
            }

            // Check token validity directly
            if (!oauth2Client.credentials) {
                throw new Error('No credentials in OAuth client');
            }
            
            if (!oauth2Client.credentials.access_token) {
                this.logOperation('error', `[${checkId}] No access token in OAuth client credentials`, {
                    userId,
                    hasCredentials: !!oauth2Client.credentials,
                    credentialKeys: oauth2Client.credentials ? Object.keys(oauth2Client.credentials) : []
                });
                throw new Error('Missing Google access token');
            }

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            // With drive.file scope, we can't list all files, so instead:
            // 1. Try to create a test folder
            // 2. Then delete it if successful
            this.logOperation('debug', `[${checkId}] Creating test folder to verify API access`);
            
            try {
                const testFolder = await drive.files.create({
                    requestBody: {
                        name: `StageVault_ConnectionTest_${checkId}`,
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id'
                });

                if (testFolder?.data?.id) {
                    // Successfully created folder, now delete it
                    await drive.files.delete({
                        fileId: testFolder.data.id
                    });
                    
                    this.logOperation('success', `[${checkId}] Google Drive connection successful`);
                    return true;
                }

                this.logOperation('error', `[${checkId}] Failed to create test folder - incomplete response`);
                return false;
            } catch (folderError) {
                // Capture specific folder operation errors
                const errorMessage = folderError instanceof Error ? folderError.message : String(folderError);
                const errorStatus = (folderError as any)?.response?.status || 'unknown';
                const errorDetails = (folderError as any)?.response?.data || {};
                
                this.logOperation('error', `[${checkId}] Drive folder operation failed: ${errorMessage}`, {
                    userId,
                    statusCode: errorStatus,
                    errorDetails,
                    errorStack: folderError instanceof Error ? folderError.stack : null
                });
                
                // Re-throw with more descriptive message
                throw new Error(`Google Drive operation failed: ${errorMessage} (${errorStatus})`);
            }
        } catch (error) {
            // Provide detailed error diagnostics
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAuthError = errorMessage.includes('auth') || 
                               errorMessage.includes('token') || 
                               errorMessage.includes('credentials') ||
                               errorMessage.includes('permission');
                               
            this.logOperation('error', `[${checkId}] Google Drive connection failed: ${errorMessage}`, {
                userId,
                isAuthError,
                errorType: error instanceof Error ? error.name : 'Unknown',
                errorStack: error instanceof Error ? error.stack : null
            });
            
            return false;
        }
    }

    /**
     * Create a folder in Google Drive
     * @param userId - The user's ID
     * @param name - The name of the folder
     * @param parentId - The ID of the parent folder (optional)
     * @returns The created folder
     */
    async createFolder(
        userId: string,
        name: string,
        parentId?: string
    ): Promise<GoogleDriveFile> {
        try {
            this.logOperation('start', `Creating folder '${name}'`, { userId, parentId });

            const oauth2Client = await getUserGoogleAuthClient(userId);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            const metadata = {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                ...(parentId && { parents: [parentId] })
            };
            
            const response = await drive.files.create({
                requestBody: metadata,
                fields: 'id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents'
            });
            
            if (!response.data) {
                throw new Error('Failed to create folder: No data returned');
            }
            
            this.logOperation('success', `Folder '${name}' created successfully`, { id: response.data.id });
            return response.data as GoogleDriveFile;
        } catch (error) {
            this.logOperation('error', `Failed to create folder '${name}': ${(error as Error).message}`, error);
            throw error;
        }
    }
    
    /**
     * Lists files in Google Drive, optionally from a specific folder
     * 
     * @param userId The Clerk user ID
     * @param folderId Optional folder ID to list files from
     * @param pageSize Optional limit on the number of files to return
     * @returns An array of Google Drive files
     */
    async listFiles(
        userId: string,
        folderId?: string,
        pageSize: number = 100
    ): Promise<GoogleDriveFile[]> {
        try {
            this.logOperation('start', 'Listing files', { userId, folderId, pageSize });

            const oauth2Client = await getUserGoogleAuthClient(userId);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            let query = "trashed = false";
            if (folderId) {
                query += ` and '${folderId}' in parents`;
            }
            
            const response = await drive.files.list({
                q: query,
                pageSize: pageSize,
                fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents,appProperties)'
            });
            
            this.logOperation('success', `Listed ${response.data.files?.length || 0} files`);
            return response.data.files as GoogleDriveFile[] || [];
        } catch (error) {
            this.logOperation('error', `Failed to list files: ${(error as Error).message}`, error);
            throw error;
        }
    }
    
    /**
     * Gets a file from Google Drive by ID
     * 
     * @param userId The Clerk user ID
     * @param fileId The Google Drive file ID
     * @returns The file object
     */
    async getFile(
        userId: string,
        fileId: string
    ): Promise<GoogleDriveFile> {
        try {
            this.logOperation('start', `Getting file '${fileId}'`, { userId });

            const oauth2Client = await getUserGoogleAuthClient(userId);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            const response = await drive.files.get({
                fileId: fileId,
                fields: 'id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents,appProperties'
            });
            
            if (!response.data) {
                throw new Error(`Failed to get file: ${fileId}`);
            }
            
            this.logOperation('success', `Retrieved file '${fileId}'`);
            return response.data as GoogleDriveFile;
        } catch (error) {
            this.logOperation('error', `Failed to get file '${fileId}': ${(error as Error).message}`, error);
            throw error;
        }
    }
    
    /**
     * Delete a file from Google Drive
     * @param userId - The user's ID (used to get OAuth token)
     * @param fileId - ID of the file to delete
     * @returns True if deletion was successful
     */
    async deleteFile(userId: string, fileId: string): Promise<boolean> {
        try {
            this.logOperation('start', `Deleting file '${fileId}'`, { userId });

            const oauth2Client = await getUserGoogleAuthClient(userId);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            await drive.files.delete({
                fileId: fileId
            });

            this.logOperation('success', `File '${fileId}' deleted successfully`);
            return true;
        } catch (error) {
            this.logOperation('error', `Failed to delete file '${fileId}': ${(error as Error).message}`, error);
            throw error;
        }
    }

    /**
     * Upload a file to Google Drive (works with Blob for client-side uploads)
     * @param userId - The user's ID (used to get OAuth token)
     * @param file - Blob or File to upload
     * @param metadata - File metadata including performance/rehearsal info
     * @param thumbnail - Optional thumbnail blob
     * @returns Upload result with file and thumbnail IDs
     */
    async uploadFile(
        userId: string,
        file: Blob,
        metadata: DriveMetadata,
        thumbnail?: Blob
    ): Promise<FileUploadResult> {
        try {
            this.logOperation('start', 'Uploading file to Google Drive (Blob)', { 
                userId,
                metadata: {
                    performanceId: metadata.performanceId,
                    performanceTitle: metadata.performanceTitle || metadata.title,
                    rehearsalId: metadata.rehearsalId,
                    rehearsalTitle: metadata.rehearsalTitle,
                    recordingId: metadata.recordingId,
                    recordingTitle: metadata.title
                }
            });

            // Get OAuth client for this user
            const oauth2Client = await getUserGoogleAuthClient(userId);
            
            // Validate OAuth client
            if (!oauth2Client) {
                throw new Error('AUTH_CLIENT_NULL: Failed to get Google OAuth client');
            }
            
            if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
                this.logOperation('error', 'Invalid OAuth client credentials', {
                    hasCredentials: !!oauth2Client.credentials,
                    hasAccessToken: oauth2Client.credentials ? !!oauth2Client.credentials.access_token : false
                });
                throw new Error('AUTH_CREDENTIALS_INVALID: Google OAuth credentials are invalid or missing access token');
            }

            // Extract access token directly for backup use if drive.auth is later null
            const accessToken = oauth2Client.credentials.access_token;
            
            // Store the token for emergency recovery in case drive.auth is lost
            const recoveryAuth = {
                userId,
                accessToken,
                tokenTimestamp: Date.now()
            };

            // Use type assertion to access the Drive object properly
            const drive = google.drive({ version: 'v3', auth: oauth2Client }) as any;
            
            // Enhance the drive object by attaching recovery information
            // This is a non-standard property but will be available during the recovery process
            // if drive.auth gets lost or becomes undefined
            try {
                drive.__recoveryAuth = recoveryAuth;
                
                // Also ensure drive.auth is properly set
                if (!drive.auth) {
                    this.logOperation('warning', 'Drive auth property missing after initialization, setting manually', {
                        hadAuth: false
                    });
                    drive.auth = oauth2Client;
                }
                
                this.logOperation('debug', 'Added recovery auth to drive object', {
                    hasRecoveryAuth: !!drive.__recoveryAuth,
                    recoveryAuthTokenLength: drive.__recoveryAuth?.accessToken?.length
                });
            } catch (e) {
                this.logOperation('warning', 'Failed to attach recovery auth to drive object', {
                    error: e instanceof Error ? e.message : String(e)
                });
            }
            
            // Validate drive object
            if (!drive) {
                throw new Error('DRIVE_OBJECT_NULL: Failed to initialize Google Drive client');
            }

            // Create a root folder for the app if it doesn't exist
            this.logOperation('progress', 'Ensuring root folder exists');
            const rootFolderId = await this.ensureRootFolder(drive);

            // Get the performance title from metadata
            // First look for specific performanceTitle field, then fall back to title, then use default
            const performanceTitle = metadata.performanceTitle || metadata.title || 'Untitled Performance';
            const performanceId = metadata.performanceId || 'default';
            
            // Create a folder for this performance if needed
            this.logOperation('progress', `Ensuring performance folder exists: ${performanceTitle}`);
            const performanceFolderId = await this.ensurePerformanceFolder(
                drive,
                rootFolderId,
                performanceId,
                performanceTitle
            );

            // Get the rehearsal title from metadata
            const rehearsalTitle = metadata.rehearsalTitle || `Rehearsal ${new Date().toLocaleDateString()}`;
            const rehearsalId = metadata.rehearsalId || 'default-rehearsal';
            
            // Create a folder for this rehearsal if needed
            this.logOperation('progress', `Ensuring rehearsal folder exists: ${rehearsalTitle}`);
            const rehearsalFolderId = await this.ensureRehearsalFolder(
                drive,
                performanceFolderId,
                rehearsalId,
                rehearsalTitle
            );

            // Prepare file name with basic metadata
            const fileName = metadata.title || `Recording ${new Date().toLocaleTimeString()}`;

            // Upload the main file - pass userId as a fallback mechanism for authentication recovery
            this.logOperation('progress', `Uploading file "${fileName}" to rehearsal folder`);
            const fileId = await this.uploadFileWithRecovery(
                drive,
                file,
                rehearsalFolderId, // Use rehearsal folder as parent
                fileName,
                file.type || 'video/mp4',
                userId,
                accessToken
            );

            // Upload the thumbnail if available
            let thumbnailId;
            if (thumbnail) {
                this.logOperation('progress', 'Uploading thumbnail');
                thumbnailId = await this.uploadFileWithRecovery(
                    drive,
                    thumbnail,
                    rehearsalFolderId, // Use rehearsal folder as parent
                    `${fileName} - Thumbnail`,
                    thumbnail.type || 'image/jpeg',
                    userId,
                    accessToken
                );
            }

            // Add metadata as properties to the file
            if (fileId) {
                this.logOperation('progress', 'Adding metadata to file');
                await this.addMetadataToFile(drive, fileId, metadata);
            }

            // Get the web view link
            const webViewLink = await this.getFileWebViewLink(drive, fileId);

            this.logOperation('success', `File uploaded successfully with ID: ${fileId}`, {
                performanceTitle,
                rehearsalTitle,
                fileName,
                hierarchyPath: `${performanceTitle}/${rehearsalTitle}/${fileName}`
            });
            
            return {
                success: true,
                fileId,
                fileName,
                thumbnailId,
                webViewLink
            };
        } catch (error) {
            this.logOperation('error', `Failed to upload file: ${(error as Error).message}`, error);
            throw error;
        }
    }

    /**
     * Uploads a file to Google Drive (works with Buffer for server-side uploads)
     * 
     * @param userId The Clerk user ID
     * @param file The file to upload (as Buffer)
     * @param fileName The name to give the file
     * @param mimeType The mime type of the file
     * @param folderId Optional folder ID to upload to
     * @returns The uploaded file object
     */
    async uploadFileWithBuffer(
        userId: string,
        file: Buffer | Blob,
        fileName: string,
        mimeType: string,
        folderId?: string
    ): Promise<GoogleDriveFile> {
        try {
            this.logOperation('start', `Uploading file '${fileName}'`, { userId, mimeType, folderId });

            const oauth2Client = await getUserGoogleAuthClient(userId);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            // Handle Buffer vs Blob
            let fileMedia;
            if (file instanceof Buffer) {
                fileMedia = {
                    body: file
                };
            } else {
                // For Blob, convert to ArrayBuffer
                // Use type assertion to tell TypeScript this is a Blob with arrayBuffer method
                const blob = file as Blob;
                const arrayBuffer = await blob.arrayBuffer();
                fileMedia = {
                    body: Buffer.from(arrayBuffer)
                };
            }
            
            const response = await drive.files.create({
                requestBody: {
                    name: fileName,
                    mimeType: mimeType,
                    ...(folderId && { parents: [folderId] })
                },
                media: fileMedia,
                fields: 'id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents'
            });
            
            if (!response.data) {
                throw new Error('Failed to upload file: No data returned');
            }
            
            this.logOperation('success', `File '${fileName}' uploaded successfully`, { id: response.data.id });
            return response.data as GoogleDriveFile;
        } catch (error) {
            this.logOperation('error', `Failed to upload file '${fileName}': ${(error as Error).message}`, error);
            throw error;
        }
    }

    // PRIVATE METHODS

    /**
     * Helper method for logging operations with timestamps and structured data
     */
    private logOperation(level: 'start' | 'progress' | 'success' | 'error' | 'info' | 'debug' | 'warning', message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}][GoogleDriveService][${level.toUpperCase()}]`;
        
        // For important levels, always log with data
        if (['error', 'start', 'success', 'warning'].includes(level)) {
            console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
        } else {
            // For less important levels, only log data if debugging is enabled
            const isDebugMode = process.env.DEBUG?.includes('google') || process.env.DEBUG === '*';
            console.log(`${prefix} ${message}`, isDebugMode && data ? JSON.stringify(data, null, 2) : '');
        }
        
        // Additional error tracking for improved diagnostics
        if (level === 'error') {
            try {
                if (typeof data === 'object' && data !== null) {
                    // Extract Google API error details if available
                    const googleError = data.response?.data?.error;
                    if (googleError) {
                        console.error(`${prefix} Google API Error:`, {
                            code: googleError.code,
                            status: googleError.status,
                            message: googleError.message,
                            errors: googleError.errors
                        });
                    }
                    
                    // Check for OAuth specific errors
                    if (data.response?.status === 401) {
                        console.error(`${prefix} OAuth Authorization Error: Token might be invalid or expired`);
                    } else if (data.response?.status === 403) {
                        console.error(`${prefix} OAuth Permission Error: Insufficient permissions or scope`);
                    }
                }
            } catch (loggingError) {
                console.error(`${prefix} Error processing error details:`, loggingError);
            }
        }
    }

    /**
     * Enhanced version of uploadFileToFolder with recovery mechanisms
     * @param drive - Google Drive API object
     * @param blob - File contents as Blob
     * @param folderId - Target folder ID
     * @param name - File name
     * @param mimeType - MIME type of the file
     * @param userId - User ID for recovery (used if drive.auth is lost)
     * @param fallbackToken - Access token for fallback authentication
     * @returns ID of the uploaded file
     */
    private async uploadFileWithRecovery(
        drive: any,
        blob: Blob,
        folderId: string,
        name: string,
        mimeType: string,
        userId?: string,
        fallbackToken?: string
    ): Promise<string> {
        try {
            this.logOperation('start', 'Starting uploadFileWithRecovery operation', {
                name,
                mimeType,
                folderId,
                blobSize: blob.size,
                blobType: blob.type,
                hasUserId: !!userId,
                hasFallbackToken: !!fallbackToken
            });

            // Ensure folderId is valid and verify it's a string
            if (!folderId || typeof folderId !== 'string') {
                throw new Error(`DRIVE_INVALID_FOLDER: Invalid folder ID: ${folderId}`);
            }

            // Validate drive object 
            if (!drive) {
                throw new Error('DRIVE_OBJECT_NULL: Google Drive API object is null or undefined');
            }

            // Get access token, with multiple fallback mechanisms
            let accessToken: string | undefined;
            
            // Try to get token from drive object first (standard path)
            if (drive.auth && drive.auth.credentials && drive.auth.credentials.access_token) {
                accessToken = drive.auth.credentials.access_token;
                // Since we just assigned accessToken and checked it's not undefined, we can safely assert it as string
                const token = accessToken as string;
                this.logOperation('debug', 'Retrieved access token from drive object', {
                    tokenLength: token.length
                });
            } 
            // Try recovery auth property we attached earlier
            else if ((drive as any).__recoveryAuth && (drive as any).__recoveryAuth.accessToken) {
                accessToken = (drive as any).__recoveryAuth.accessToken;
                // Since we just assigned accessToken and checked it's not undefined, we can safely assert it as string
                const token = accessToken as string;
                this.logOperation('debug', 'Retrieved access token from recovery property', {
                    tokenLength: token.length,
                    recoveryAuthAge: Date.now() - ((drive as any).__recoveryAuth.tokenTimestamp || 0)
                });
            }
            // Use the fallback token passed directly (most reliable)
            else if (fallbackToken) {
                accessToken = fallbackToken;
                // Fallback token is guaranteed to be defined here
                const token = accessToken as string;
                this.logOperation('debug', 'Using fallback access token', {
                    tokenLength: token.length
                });
            }
            // If we have userId, try to get a fresh token (last resort)
            else if (userId) {
                try {
                    this.logOperation('warning', 'All token recovery methods failed, getting fresh token', {
                        userId
                    });
                    const oauth2Client = await getUserGoogleAuthClient(userId);
                    if (oauth2Client && oauth2Client.credentials && oauth2Client.credentials.access_token) {
                        accessToken = oauth2Client.credentials.access_token;
                        // Fresh token is guaranteed to be defined here
                        const token = accessToken as string;
                        this.logOperation('debug', 'Retrieved fresh token for recovery', {
                            tokenLength: token.length
                        });
                    }
                } catch (tokenError) {
                    this.logOperation('error', 'Failed to get fresh token for recovery', {
                        error: tokenError instanceof Error ? tokenError.message : String(tokenError)
                    });
                }
            }
            
            // If all methods failed, we can't proceed
            if (!accessToken) {
                throw new Error('DRIVE_AUTH_MISSING: Google Drive API object missing valid auth. Try reconnecting your Google account.');
            }
            
            // From this point on, accessToken is guaranteed to be a string (not undefined)
            // because we've thrown an error if it's undefined
            const token = accessToken;
            
            // Log what we have now
            this.logOperation('debug', 'Proceeding with upload using access token', {
                hasAccessToken: true,
                tokenLength: token.length,
                folderId
            });

            const metadata = {
                name: name,
                mimeType: mimeType,
                parents: [folderId] // Ensure parents is an array of strings, not an array of objects
            };

            // Log metadata being sent
            this.logOperation('debug', 'Preparing metadata for upload', {
                metadata: JSON.stringify(metadata),
                blobSizeBytes: blob.size
            });

            // Create a multi-part request for both metadata and file content
            const form = new FormData();
            form.append(
                'metadata',
                new Blob([JSON.stringify(metadata)], { type: 'application/json' })
            );
            form.append('file', blob);
            
            this.logOperation('debug', 'Sending multipart upload request', {
                uploadUrl: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                hasAccessToken: true,
                accessTokenLength: token.length,
                formDataParts: ['metadata', 'file']
            });

            try {
                const response = await fetch(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: form
                    }
                );

                // Log response status and headers
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                this.logOperation('debug', 'Received upload response', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    this.logOperation('error', 'Upload failed with error response', {
                        status: response.status,
                        statusText: response.statusText,
                        errorText: errorText
                    });
                    
                    // Handle specific error cases
                    if (response.status === 403) {
                        throw new Error('DRIVE_PERMISSION_DENIED: Cannot upload files. Check app permissions.');
                    } else if (response.status === 401) {
                        throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                    } else if (response.status === 404) {
                        throw new Error(`DRIVE_FOLDER_NOT_FOUND: Upload folder ${folderId} not found.`);
                    } else if (errorText.includes('userRateLimitExceeded')) {
                        throw new Error('DRIVE_RATE_LIMIT: Too many requests to Google Drive. Please try again later.');
                    } else if (errorText.includes('storageQuotaExceeded')) {
                        throw new Error('DRIVE_QUOTA_EXCEEDED: Google Drive storage is full. Please free up space.');
                    } else {
                        throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
                    }
                }

                const data = await response.json();
                this.logOperation('success', 'File uploaded successfully', {
                    fileId: data.id,
                    fileName: data.name,
                    responseData: data
                });

                return data.id;
            } catch (fetchError: unknown) {
                // Handle network-level errors (not API errors)
                if (fetchError instanceof Error && fetchError.message.includes('fetch')) {
                    this.logOperation('error', 'Network error during upload', {
                        errorMessage: fetchError.message
                    });
                    throw new Error('DRIVE_NETWORK_ERROR: Network problem during upload. Check internet connection.');
                }
                
                // Re-throw the error (could be our custom errors from above or other errors)
                throw fetchError;
            }
        } catch (error) {
            this.logOperation('error', `Failed in uploadFileWithRecovery: ${(error as Error).message}`, {
                error: error,
                name: name,
                folderId: folderId,
                errorStack: (error as Error).stack
            });
            throw error;
        }
    }

    /**
     * Ensure a root folder exists for all app files
     * @param drive - Google Drive API object
     * @returns ID of the root folder
     */
    private async ensureRootFolder(drive: any): Promise<string> {
        try {
            // Log the start of the operation
            this.logOperation('start', 'Starting ensureRootFolder operation', {
                rootFolderName: this.ROOT_FOLDER_NAME
            });

            // Check if the folder already exists
            const query = `name='${this.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            this.logOperation('debug', 'Checking if root folder exists', {
                query,
                fields: 'files(id, name)'
            });

            try {
                const response = await drive.files.list({
                    q: query,
                    fields: 'files(id, name)'
                });

                // Log the files.list response
                this.logOperation('debug', 'Response from files.list for root folder', {
                    filesCount: response.data.files?.length || 0,
                    firstFile: response.data.files?.[0] || null,
                    responseStatus: response.status
                });

                // If folder exists, return its ID
                if (response.data.files && response.data.files.length > 0) {
                    this.logOperation('info', `Root folder "${this.ROOT_FOLDER_NAME}" already exists`, {
                        folderId: response.data.files[0].id,
                        folderName: response.data.files[0].name
                    });
                    return response.data.files[0].id;
                }
            } catch (listError) {
                const status = (listError as any)?.response?.status;
                const errorDetails = (listError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error listing root folder', {
                    status,
                    errorDetails,
                    errorMessage: (listError as Error).message
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot access Drive files. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw listError;
            }

            // If folder doesn't exist, create it
            this.logOperation('info', `Creating root folder "${this.ROOT_FOLDER_NAME}"`, {
                folderName: this.ROOT_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
                fields: 'id'
            });

            try {
                const createResponse = await drive.files.create({
                    requestBody: {
                        name: this.ROOT_FOLDER_NAME,
                        mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id'
                });

                // Log the files.create response
                this.logOperation('success', `Root folder "${this.ROOT_FOLDER_NAME}" created successfully`, {
                    folderId: createResponse.data.id,
                    responseStatus: createResponse.status
                });

                return createResponse.data.id;
            } catch (createError) {
                const status = (createError as any)?.response?.status;
                const errorDetails = (createError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error creating root folder', {
                    status,
                    errorDetails,
                    errorMessage: (createError as Error).message
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot create folders. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'userRateLimitExceeded')) {
                    throw new Error('DRIVE_RATE_LIMIT: Too many requests to Google Drive. Please try again later.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'storageQuotaExceeded')) {
                    throw new Error('DRIVE_QUOTA_EXCEEDED: Google Drive storage is full. Please free up space.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw createError;
            }
        } catch (error) {
            this.logOperation('error', `Failed to ensure root folder: ${(error as Error).message}`, {
                rootFolderName: this.ROOT_FOLDER_NAME,
                error: error,
                errorStack: (error as Error).stack
            });
            throw error;
        }
    }

    /**
     * Find the root folder for app files
     * @param userId - The user's ID (used to get OAuth token)
     * @returns Folder info (id and name)
     */
    private async findRootFolder(userId: string): Promise<FolderInfo | null> {
        try {
            const oauth2Client = await getUserGoogleAuthClient(userId);
            
            if (!oauth2Client) {
                throw new Error('Failed to get OAuth client for user');
            }

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            const response = await drive.files.list({
                q: `name='${this.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)'
            });

            if (response.data.files && response.data.files.length > 0) {
                return {
                    id: response.data.files[0].id || '',
                    name: response.data.files[0].name || ''
                };
            }

            return null;
        } catch (error) {
            this.logOperation('error', `Failed to find root folder: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Ensure a folder exists for a specific performance
     * @param drive - Google Drive API object
     * @param parentId - Parent folder ID
     * @param performanceId - Performance identifier
     * @param performanceTitle - Performance title
     * @returns ID of the performance folder
     */
    private async ensurePerformanceFolder(
        drive: any,
        parentId: string,
        performanceId: string,
        performanceTitle: string
    ): Promise<string> {
        try {
            // Log the start of the operation
            this.logOperation('start', 'Starting ensurePerformanceFolder operation', {
                parentId,
                performanceId,
                performanceTitle
            });

            const folderName = `${performanceTitle} - (${performanceId})`;
            this.logOperation('debug', 'Generated performance folder name', {
                folderName,
                performanceId,
                performanceTitle
            });

            // Check if the folder already exists
            const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            this.logOperation('debug', 'Checking if performance folder exists', {
                query,
                parentId,
                folderName,
                fields: 'files(id, name)'
            });

            try {
                const response = await drive.files.list({
                    q: query,
                    fields: 'files(id, name)'
                });

                // Log the files.list response
                this.logOperation('debug', 'Response from files.list for performance folder', {
                    filesCount: response.data.files?.length || 0,
                    firstFile: response.data.files?.[0] || null,
                    responseStatus: response.status
                });

                // If folder exists, return its ID
                if (response.data.files && response.data.files.length > 0) {
                    this.logOperation('info', `Performance folder "${folderName}" already exists`, {
                        folderId: response.data.files[0].id,
                        folderName: response.data.files[0].name,
                        parentId
                    });
                    return response.data.files[0].id;
                }
            } catch (listError) {
                const status = (listError as any)?.response?.status;
                const errorDetails = (listError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error listing performance folder', {
                    status,
                    errorDetails,
                    errorMessage: (listError as Error).message,
                    folderName
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot access Drive files. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw listError;
            }

            // If folder doesn't exist, create it
            this.logOperation('info', `Creating performance folder "${folderName}"`, {
                folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parentId,
                fields: 'id'
            });

            try {
                // Ensure parentId is valid and verify it's a string
                if (!parentId || typeof parentId !== 'string') {
                    throw new Error(`DRIVE_INVALID_PARENT: Invalid parent folder ID: ${parentId}`);
                }

                const createResponse = await drive.files.create({
                    requestBody: {
                        name: folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [parentId] // Ensure parents is an array of strings
                    },
                    fields: 'id'
                });

                // Log the files.create response
                this.logOperation('success', `Performance folder "${folderName}" created successfully`, {
                    folderId: createResponse.data.id,
                    parentId,
                    responseStatus: createResponse.status
                });

                return createResponse.data.id;
            } catch (createError) {
                const status = (createError as any)?.response?.status;
                const errorDetails = (createError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error creating performance folder', {
                    status,
                    errorDetails,
                    errorMessage: (createError as Error).message,
                    folderName,
                    parentId
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot create folders. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'notFound')) {
                    throw new Error(`DRIVE_PARENT_NOT_FOUND: Parent folder ${parentId} not found.`);
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'userRateLimitExceeded')) {
                    throw new Error('DRIVE_RATE_LIMIT: Too many requests to Google Drive. Please try again later.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'storageQuotaExceeded')) {
                    throw new Error('DRIVE_QUOTA_EXCEEDED: Google Drive storage is full. Please free up space.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw createError;
            }
        } catch (error) {
            this.logOperation('error', `Failed to ensure performance folder: ${(error as Error).message}`, {
                folderName: `${performanceTitle} (${performanceId})`,
                parentId,
                performanceId,
                performanceTitle,
                error: error,
                errorStack: (error as Error).stack
            });
            throw error;
        }
    }

    /**
     * Add metadata to a file
     * @param drive - Google Drive API object
     * @param fileId - ID of the file
     * @param metadata - Metadata key-value pairs
     */
    private async addMetadataToFile(
        drive: any,
        fileId: string,
        metadata: DriveMetadata
    ): Promise<void> {
        try {
            // Convert all metadata values to strings
            const appProperties: Record<string, string> = {};

            for (const [key, value] of Object.entries(metadata)) {
                if (value !== undefined && value !== null) {
                    appProperties[key] = String(value);
                }
            }

            // Update the file with the metadata as appProperties
            await drive.files.update({
                fileId: fileId,
                requestBody: {
                    appProperties
                }
            });
        } catch (error) {
            this.logOperation('error', `Failed to add metadata to file: ${(error as Error).message}`, error);
            throw error;
        }
    }

    /**
     * Get the web view link for a file
     * @param drive - Google Drive API object
     * @param fileId - ID of the file
     * @returns Web view link or empty string if not found
     */
    private async getFileWebViewLink(
        drive: any,
        fileId: string
    ): Promise<string | undefined> {
        try {
            const response = await drive.files.get({
                fileId: fileId,
                fields: 'webViewLink'
            });

            return response.data.webViewLink || '';
        } catch (error) {
            this.logOperation('error', `Failed to get web view link: ${(error as Error).message}`);
            return undefined;
        }
    }

    /**
     * Ensure a folder exists for a specific rehearsal inside a performance folder
     * @param drive - Google Drive API object
     * @param parentId - Parent folder ID (performance folder)
     * @param rehearsalId - Rehearsal identifier
     * @param rehearsalTitle - Rehearsal title
     * @returns ID of the rehearsal folder
     */
    private async ensureRehearsalFolder(
        drive: any,
        parentId: string,
        rehearsalId: string,
        rehearsalTitle: string
    ): Promise<string> {
        try {
            // Log the start of the operation
            this.logOperation('start', 'Starting ensureRehearsalFolder operation', {
                parentId,
                rehearsalId,
                rehearsalTitle
            });

            const folderName = `${rehearsalTitle} - (${rehearsalId})`;
            this.logOperation('debug', 'Generated rehearsal folder name', {
                folderName,
                rehearsalId,
                rehearsalTitle
            });

            // Check if the folder already exists
            const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            this.logOperation('debug', 'Checking if rehearsal folder exists', {
                query,
                parentId,
                folderName,
                fields: 'files(id, name)'
            });

            try {
                const response = await drive.files.list({
                    q: query,
                    fields: 'files(id, name)'
                });

                // Log the files.list response
                this.logOperation('debug', 'Response from files.list for rehearsal folder', {
                    filesCount: response.data.files?.length || 0,
                    firstFile: response.data.files?.[0] || null,
                    responseStatus: response.status
                });

                // If folder exists, return its ID
                if (response.data.files && response.data.files.length > 0) {
                    this.logOperation('info', `Rehearsal folder "${folderName}" already exists`, {
                        folderId: response.data.files[0].id,
                        folderName: response.data.files[0].name,
                        parentId
                    });
                    return response.data.files[0].id;
                }
            } catch (listError) {
                const status = (listError as any)?.response?.status;
                const errorDetails = (listError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error listing rehearsal folder', {
                    status,
                    errorDetails,
                    errorMessage: (listError as Error).message,
                    folderName
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot access Drive files. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw listError;
            }

            // If folder doesn't exist, create it
            this.logOperation('info', `Creating rehearsal folder "${folderName}"`, {
                folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parentId,
                fields: 'id'
            });

            try {
                // Ensure parentId is valid and verify it's a string
                if (!parentId || typeof parentId !== 'string') {
                    throw new Error(`DRIVE_INVALID_PARENT: Invalid parent folder ID: ${parentId}`);
                }

                const createResponse = await drive.files.create({
                    requestBody: {
                        name: folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [parentId] // Ensure parents is an array of strings
                    },
                    fields: 'id'
                });

                // Log the files.create response
                this.logOperation('success', `Rehearsal folder "${folderName}" created successfully`, {
                    folderId: createResponse.data.id,
                    parentId,
                    responseStatus: createResponse.status
                });

                return createResponse.data.id;
            } catch (createError) {
                const status = (createError as any)?.response?.status;
                const errorDetails = (createError as any)?.response?.data?.error;
                
                this.logOperation('error', 'Error creating rehearsal folder', {
                    status,
                    errorDetails,
                    errorMessage: (createError as Error).message,
                    folderName,
                    parentId
                });
                
                if (status === 403) {
                    throw new Error('DRIVE_PERMISSION_DENIED: Cannot create folders. Check app permissions.');
                } else if (status === 401) {
                    throw new Error('DRIVE_AUTH_ERROR: Authentication failed. Try reconnecting your Google account.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'notFound')) {
                    throw new Error(`DRIVE_PARENT_NOT_FOUND: Parent folder ${parentId} not found.`);
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'userRateLimitExceeded')) {
                    throw new Error('DRIVE_RATE_LIMIT: Too many requests to Google Drive. Please try again later.');
                } else if (errorDetails?.errors?.some((e: any) => e.reason === 'storageQuotaExceeded')) {
                    throw new Error('DRIVE_QUOTA_EXCEEDED: Google Drive storage is full. Please free up space.');
                }
                
                // Re-throw the original error if we can't categorize it
                throw createError;
            }
        } catch (error) {
            this.logOperation('error', `Failed to ensure rehearsal folder: ${(error as Error).message}`, {
                folderName: `${rehearsalTitle} (${rehearsalId})`,
                parentId,
                rehearsalId,
                rehearsalTitle,
                error: error,
                errorStack: (error as Error).stack
            });
            throw error;
        }
    }
}

// Export a singleton instance
export const googleDriveService = new GoogleDriveService(); 