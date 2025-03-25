// lib/GoogleDriveService.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleRefreshToken } from './clerkAuth';

// Types
interface FileUploadResult {
    success: boolean;
    fileId: string;
    fileName: string;
    thumbnailId?: string;
    webViewLink?: string;
}

interface FolderInfo {
    id: string;
    name: string;
}

interface DriveMetadata {
    performanceId?: string;
    rehearsalId?: string;
    recordingId?: string;
    title?: string;
    description?: string;
    date?: string;
    time?: string;
    duration?: number;
    [key: string]: any;
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
 */
export class GoogleDriveService {
    private readonly ROOT_FOLDER_NAME = 'StageVault Recordings';
    private readonly CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    private readonly CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
    private readonly REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

    /**
     * Check if the Google Drive connection is working
     * @param userId - The user's ID
     * @returns True if connection is working, false otherwise
     */
    async checkConnection(userId: string): Promise<boolean> {
        try {
            this.logOperation('start', 'Checking Google Drive connection', { userId });

            // Create an OAuth client for this user
            // This will automatically get the token from Clerk's wallet
            const oauth2Client = await this.getUserAuthClient(userId);
            
            if (!oauth2Client) {
                this.logOperation('error', 'Failed to get OAuth client', { 
                    userId,
                    reason: 'OAuth client creation failed - likely a token issue'
                });
                throw new Error('Failed to create Google OAuth client');
            }

            // Check token validity directly
            if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
                this.logOperation('error', 'No access token in OAuth client credentials', {
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
            this.logOperation('progress', 'Creating test folder');
            
            try {
                const testFolder = await drive.files.create({
                    requestBody: {
                        name: 'StageVault_ConnectionTest',
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id'
                });

                if (testFolder?.data?.id) {
                    // Successfully created folder, now delete it
                    this.logOperation('progress', 'Deleting test folder', { folderId: testFolder.data.id });
                    await drive.files.delete({
                        fileId: testFolder.data.id
                    });
                    this.logOperation('success', 'Google Drive connection successful');
                    return true;
                }

                this.logOperation('error', 'Failed to create test folder - incomplete response', {
                    userId,
                    response: JSON.stringify(testFolder || {})
                });
                return false;
            } catch (folderError) {
                // Capture specific folder operation errors
                const errorMessage = folderError instanceof Error ? folderError.message : String(folderError);
                const errorStatus = (folderError as any)?.response?.status || 'unknown';
                const errorDetails = (folderError as any)?.response?.data || {};
                
                this.logOperation('error', `Drive folder operation failed: ${errorMessage}`, {
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
                               
            this.logOperation('error', `Google Drive connection failed: ${errorMessage}`, {
                userId,
                isAuthError,
                errorType: error instanceof Error ? error.name : 'Unknown',
                errorStack: error instanceof Error ? error.stack : null,
                error: JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2)
            });
            
            return false;
        }
    }

    /**
     * Generate an authorization URL for OAuth consent screen
     * @returns URL for OAuth consent screen
     */
    generateAuthUrl(): string {
        try {
            this.logOperation('start', 'Generating Google Auth URL');

            if (!this.CLIENT_ID || !this.CLIENT_SECRET || !this.REDIRECT_URI) {
                const missingVars = [
                    !this.CLIENT_ID ? 'CLIENT_ID' : null,
                    !this.CLIENT_SECRET ? 'CLIENT_SECRET' : null,
                    !this.REDIRECT_URI ? 'REDIRECT_URI' : null
                ].filter(Boolean);
                
                this.logOperation('error', 'Missing Google OAuth credentials in environment variables', { missingVars });
                throw new Error('Missing Google OAuth credentials in environment variables');
            }

            const oauth2Client = this.createOAuth2Client();

            // Define the scopes we need
            const scopes = [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.metadata.readonly'
            ];
            
            this.logOperation('debug', 'Configuring OAuth parameters', {
                scopes,
                access_type: 'offline',
                prompt: 'consent',
                redirect_uri: this.REDIRECT_URI
            });

            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent' // Force to always display consent screen to get refresh token
            });

            this.logOperation('success', 'Generated Google Auth URL', { 
                urlLength: url.length,
                urlStart: url.substring(0, 30) + '...'
            });
            return url;
        } catch (error) {
            this.logOperation('error', `Failed to generate auth URL: ${(error as Error).message}`, error);
            throw error;
        }
    }

    /**
     * Exchange authorization code for tokens
     * @param code - Authorization code from OAuth consent
     * @returns Tokens object containing access_token and refresh_token
     */
    async exchangeCodeForTokens(code: string) {
        try {
            this.logOperation('start', 'Exchanging code for tokens', { 
                codeLength: code ? code.length : 0,
                codeStart: code ? code.substring(0, 10) + '...' : null 
            });

            if (!this.CLIENT_ID || !this.CLIENT_SECRET || !this.REDIRECT_URI) {
                const missingVars = [
                    !this.CLIENT_ID ? 'CLIENT_ID' : null,
                    !this.CLIENT_SECRET ? 'CLIENT_SECRET' : null,
                    !this.REDIRECT_URI ? 'REDIRECT_URI' : null
                ].filter(Boolean);
                
                this.logOperation('error', 'Missing Google OAuth credentials in environment variables', { missingVars });
                throw new Error('Missing Google OAuth credentials in environment variables');
            }

            const oauth2Client = this.createOAuth2Client();
            
            // Using getToken to exchange code for tokens
            this.logOperation('debug', 'Calling getToken method', { 
                client_id: this.CLIENT_ID.substring(0, 5) + '...',
                redirect_uri: this.REDIRECT_URI
            });
            
            const { tokens } = await oauth2Client.getToken(code);
            
            this.logOperation('debug', 'Token exchange response received', {
                hasAccessToken: !!tokens.access_token,
                hasRefreshToken: !!tokens.refresh_token,
                hasExpiry: !!tokens.expiry_date,
                scope: tokens.scope
            });

            if (!tokens.refresh_token) {
                this.logOperation('error', 'No refresh token returned', {
                    possibleCause: 'Make sure you set prompt=consent and access_type=offline',
                    receivedScopes: tokens.scope
                });
                throw new Error('No refresh token returned. Make sure you set prompt=consent and access_type=offline');
            }

            this.logOperation('success', 'Successfully exchanged code for tokens', {
                tokenType: tokens.token_type,
                scopes: tokens.scope?.split(' '),
                expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 'unknown'
            });
            
            return tokens;
        } catch (error) {
            this.logOperation('error', `Failed to exchange code for tokens: ${(error as Error).message}`, error);
            throw error;
        }
    }

    /**
     * Upload a file to Google Drive
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
            this.logOperation('start', 'Uploading file to Google Drive', { userId });

            // Get OAuth client for this user
            const oauth2Client = await this.getUserAuthClient(userId);
            
            if (!oauth2Client) {
                throw new Error('Failed to get OAuth client for user');
            }
            
            // Use the OAuth client for Drive API
            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            // Create a root folder for the app if it doesn't exist
            this.logOperation('progress', 'Ensuring root folder exists');
            const rootFolderId = await this.ensureRootFolder(drive);

            // Create a folder for this performance if needed
            this.logOperation('progress', 'Ensuring performance folder exists');
            const performanceFolderId = await this.ensurePerformanceFolder(
                drive,
                rootFolderId,
                metadata.performanceId || 'default',
                metadata.title || 'Untitled Performance'
            );

            // Prepare file name with basic metadata
            const fileName = `${metadata.title || 'Recording'} - ${metadata.time || new Date().toLocaleTimeString()}`;

            // Upload the main file
            this.logOperation('progress', `Uploading file "${fileName}"`);
            const fileId = await this.uploadFileToFolder(
                drive,
                file,
                performanceFolderId,
                fileName,
                file.type || 'video/mp4'
            );

            // Upload the thumbnail if available
            let thumbnailId;
            if (thumbnail) {
                this.logOperation('progress', 'Uploading thumbnail');
                thumbnailId = await this.uploadFileToFolder(
                    drive,
                    thumbnail,
                    performanceFolderId,
                    `${fileName} - Thumbnail`,
                    thumbnail.type || 'image/jpeg'
                );
            }

            // Add metadata as properties to the file
            if (fileId) {
                this.logOperation('progress', 'Adding metadata to file');
                await this.addMetadataToFile(drive, fileId, metadata);
            }

            // Get the web view link
            const webViewLink = await this.getFileWebViewLink(drive, fileId);

            this.logOperation('success', `File uploaded successfully with ID: ${fileId}`);
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
     * List files in a specific folder in Google Drive
     * @param refreshToken - OAuth refresh token
     * @param folderId - Optional folder ID (uses root folder if not specified)
     * @returns Array of file metadata objects
     */
    async listFiles(refreshToken: string, folderId?: string): Promise<any[]> {
        try {
            this.logOperation('start', 'Listing files');

            const oauth2Client = this.createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            // If no folder specified, get the root folder
            if (!folderId) {
                this.logOperation('progress', 'No folder ID specified, finding root folder');
                const rootFolder = await this.findRootFolder(refreshToken);
                folderId = rootFolder?.id;
            }

            if (!folderId) {
                throw new Error('Could not determine folder ID for listing files');
            }

            this.logOperation('progress', `Listing files in folder ID: ${folderId}`);
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime, modifiedTime, size, appProperties)',
                orderBy: 'modifiedTime desc'
            });

            this.logOperation('success', `Listed ${response.data.files?.length || 0} files`);
            return response.data.files || [];
        } catch (error) {
            this.logOperation('error', `Failed to list files: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Delete a file from Google Drive
     * @param refreshToken - OAuth refresh token
     * @param fileId - ID of the file to delete
     * @returns True if deletion was successful
     */
    async deleteFile(refreshToken: string, fileId: string): Promise<boolean> {
        try {
            this.logOperation('start', `Deleting file with ID: ${fileId}`);

            const oauth2Client = this.createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            await drive.files.delete({
                fileId: fileId
            });

            this.logOperation('success', `File deleted successfully`);
            return true;
        } catch (error) {
            this.logOperation('error', `Failed to delete file: ${(error as Error).message}`);
            return false;
        }
    }

    // PRIVATE METHODS

    /**
     * Create an OAuth2 client with configured credentials
     * @returns Configured OAuth2Client
     */
    private createOAuth2Client(): OAuth2Client {
        return new google.auth.OAuth2(
            this.CLIENT_ID,
            this.CLIENT_SECRET,
            this.REDIRECT_URI
        );
    }

    /**
     * Get an access token using a refresh token
     * @param refreshToken - OAuth refresh token
     * @returns Access token
     */
    private async getAccessToken(refreshToken: string): Promise<string> {
        try {
            this.logOperation('start', 'Getting access token');

            if (!refreshToken) {
                throw new Error('No refresh token provided');
            }

            const oauth2Client = this.createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const { token } = await oauth2Client.getAccessToken();

            if (!token) {
                throw new Error('Failed to get access token');
            }

            this.logOperation('success', 'Got access token');
            return token;
        } catch (error) {
            this.logOperation('error', `Failed to get access token: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Upload a file to a specific folder
     * @param drive - Google Drive API object
     * @param blob - File contents as Blob
     * @param folderId - Target folder ID
     * @param name - File name
     * @param mimeType - MIME type of the file
     * @returns ID of the uploaded file
     */
    private async uploadFileToFolder(
        drive: any,
        blob: Blob,
        folderId: string,
        name: string,
        mimeType: string
    ): Promise<string> {
        const metadata = {
            name: name,
            mimeType: mimeType,
            parents: [folderId]
        };

        // Create a multi-part request for both metadata and file content
        const form = new FormData();
        form.append(
            'metadata',
            new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        form.append('file', blob);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`
                },
                body: form
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data.id;
    }

    /**
     * Ensure a root folder exists for all app files
     * @param drive - Google Drive API object
     * @returns ID of the root folder
     */
    private async ensureRootFolder(drive: any): Promise<string> {
        // Check if the folder already exists
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${this.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`
                }
            }
        );

        if (!searchResponse.ok) {
            throw new Error(`Failed to search for root folder: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();

        // If folder exists, return its ID
        if (searchData.files && searchData.files.length > 0) {
            this.logOperation('info', `Root folder "${this.ROOT_FOLDER_NAME}" already exists`);
            return searchData.files[0].id;
        }

        // If folder doesn't exist, create it
        this.logOperation('info', `Creating root folder "${this.ROOT_FOLDER_NAME}"`);
        const createResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.ROOT_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            }
        );

        if (!createResponse.ok) {
            throw new Error(`Failed to create root folder: ${createResponse.status}`);
        }

        const createData = await createResponse.json();
        return createData.id;
    }

    /**
     * Find the root folder for app files
     * @param refreshToken - OAuth refresh token
     * @returns Folder info (id and name)
     */
    private async findRootFolder(refreshToken: string): Promise<FolderInfo | null> {
        try {
            const oauth2Client = this.createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

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
        const folderName = `${performanceTitle} (${performanceId})`;

        // Check if the folder already exists
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`
                }
            }
        );

        if (!searchResponse.ok) {
            throw new Error(`Failed to search for performance folder: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();

        // If folder exists, return its ID
        if (searchData.files && searchData.files.length > 0) {
            this.logOperation('info', `Performance folder "${folderName}" already exists`);
            return searchData.files[0].id;
        }

        // If folder doesn't exist, create it
        this.logOperation('info', `Creating performance folder "${folderName}"`);
        const createResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                })
            }
        );

        if (!createResponse.ok) {
            throw new Error(`Failed to create performance folder: ${createResponse.status}`);
        }

        const createData = await createResponse.json();
        return createData.id;
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
        // Convert all metadata values to strings
        const appProperties: Record<string, string> = {};

        for (const [key, value] of Object.entries(metadata)) {
            if (value !== undefined && value !== null) {
                appProperties[key] = String(value);
            }
        }

        // Update the file with the metadata as appProperties
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${drive.auth.credentials.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appProperties
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to add metadata to file: ${response.status}`);
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
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
                {
                    headers: {
                        Authorization: `Bearer ${drive.auth.credentials.access_token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to get file info: ${response.status}`);
            }

            const data = await response.json();
            return data.webViewLink || '';
        } catch (error) {
            this.logOperation('error', `Failed to get web view link: ${(error as Error).message}`);
            return undefined;
        }
    }

    /**
     * Helper method for logging operations with timestamps and structured data
     */
    private logOperation(level: 'start' | 'progress' | 'success' | 'error' | 'info' | 'debug', message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}][GoogleDriveService][${level.toUpperCase()}]`;
        
        // For important levels, always log with data
        if (['error', 'start', 'success'].includes(level)) {
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
     * Get a Google Auth client for a specific user
     * This abstracts the token acquisition
     * @param userId - The user's ID
     * @returns The OAuth2 client
     */
    private async getUserAuthClient(userId: string): Promise<OAuth2Client | null> {
        try {
            // Import the entire module and use its exported function
            const googleAuth = await import('@/lib/googleAuth');
            
            try {
                return await googleAuth.getUserGoogleAuthClient(userId);
            } catch (authError) {
                // Enhanced error handling with diagnostics
                const errorMessage = authError instanceof Error ? authError.message : String(authError);
                
                // Check for specific error types to provide better error messages
                const needsReconnect = errorMessage.includes('reconnect') || 
                                      errorMessage.includes('No Google access token');
                
                if (needsReconnect) {
                    this.logOperation('error', 'User needs to reconnect Google account', {
                        userId,
                        action: 'reconnect_required',
                        originalError: errorMessage
                    });
                } else {
                    this.logOperation('error', `Google Auth client creation failed: ${errorMessage}`, {
                        userId,
                        error: authError,
                        stack: authError instanceof Error ? authError.stack : null
                    });
                }
                
                // Rethrow to allow the caller to handle it
                throw authError;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.logOperation('error', `Failed to get OAuth client: ${errorMessage}`, {
                userId,
                errorType: error instanceof Error ? error.name : 'UnknownError',
                stack: error instanceof Error ? error.stack : null,
                isTokenIssue: errorMessage.includes('token') || errorMessage.includes('OAuth') || errorMessage.includes('auth')
            });
            
            return null;
        }
    }
}

// Export a singleton instance
export const googleDriveService = new GoogleDriveService(); 