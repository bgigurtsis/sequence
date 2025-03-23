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
     * @param refreshToken - OAuth refresh token
     * @returns True if connection is working, false otherwise
     */
    async checkConnection(refreshToken: string): Promise<boolean> {
        try {
            this.logOperation('start', 'Checking Google Drive connection');

            if (!refreshToken) {
                this.logOperation('error', 'No refresh token provided');
                return false;
            }

            const oauth2Client = this.createOAuth2Client();
            oauth2Client.setCredentials({ refresh_token: refreshToken });

            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            // With drive.file scope, we can't list all files, so instead:
            // 1. Try to create a test folder
            // 2. Then delete it if successful
            this.logOperation('progress', 'Creating test folder');
            const testFolder = await drive.files.create({
                requestBody: {
                    name: 'StageVault_ConnectionTest',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id'
            });

            if (testFolder?.data?.id) {
                // Successfully created folder, now delete it
                this.logOperation('progress', 'Deleting test folder');
                await drive.files.delete({
                    fileId: testFolder.data.id
                });
                this.logOperation('success', 'Google Drive connection successful');
                return true;
            }

            this.logOperation('error', 'Failed to create test folder');
            return false;
        } catch (error) {
            this.logOperation('error', `Google Drive connection failed: ${(error as Error).message}`);
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
                throw new Error('Missing Google OAuth credentials in environment variables');
            }

            const oauth2Client = this.createOAuth2Client();

            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: [
                    'https://www.googleapis.com/auth/userinfo.profile',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.metadata.readonly'
                ],
                prompt: 'consent' // Force to always display consent screen to get refresh token
            });

            this.logOperation('success', 'Generated Google Auth URL');
            return url;
        } catch (error) {
            this.logOperation('error', `Failed to generate auth URL: ${(error as Error).message}`);
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
            this.logOperation('start', 'Exchanging code for tokens');

            if (!this.CLIENT_ID || !this.CLIENT_SECRET || !this.REDIRECT_URI) {
                throw new Error('Missing Google OAuth credentials in environment variables');
            }

            const oauth2Client = this.createOAuth2Client();
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                throw new Error('No refresh token returned. Make sure you set prompt=consent and access_type=offline');
            }

            this.logOperation('success', 'Successfully exchanged code for tokens');
            return tokens;
        } catch (error) {
            this.logOperation('error', `Failed to exchange code for tokens: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Upload a file to Google Drive
     * @param refreshToken - OAuth refresh token
     * @param file - Blob or File to upload
     * @param metadata - File metadata including performance/rehearsal info
     * @param thumbnail - Optional thumbnail blob
     * @returns Upload result with file and thumbnail IDs
     */
    async uploadFile(
        refreshToken: string,
        file: Blob,
        metadata: DriveMetadata,
        thumbnail?: Blob
    ): Promise<FileUploadResult> {
        try {
            this.logOperation('start', 'Uploading file to Google Drive');

            // Get an access token using the refresh token
            const accessToken = await this.getAccessToken(refreshToken);

            // Create a root folder for the app if it doesn't exist
            this.logOperation('progress', 'Ensuring root folder exists');
            const rootFolderId = await this.ensureRootFolder(accessToken);

            // Create a folder for this performance if needed
            this.logOperation('progress', 'Ensuring performance folder exists');
            const performanceFolderId = await this.ensurePerformanceFolder(
                accessToken,
                rootFolderId,
                metadata.performanceId || 'default',
                metadata.title || 'Untitled Performance'
            );

            // Prepare file name with basic metadata
            const fileName = `${metadata.title || 'Recording'} - ${metadata.time || new Date().toLocaleTimeString()}`;

            // Upload the main file
            this.logOperation('progress', `Uploading file "${fileName}"`);
            const fileId = await this.uploadFileToFolder(
                accessToken,
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
                    accessToken,
                    thumbnail,
                    performanceFolderId,
                    `${fileName} - Thumbnail`,
                    thumbnail.type || 'image/jpeg'
                );
            }

            // Add metadata as properties to the file
            if (fileId) {
                this.logOperation('progress', 'Adding metadata to file');
                await this.addMetadataToFile(accessToken, fileId, metadata);
            }

            // Get the web view link
            const webViewLink = await this.getFileWebViewLink(accessToken, fileId);

            this.logOperation('success', `File uploaded successfully with ID: ${fileId}`);
            return {
                success: true,
                fileId,
                fileName,
                thumbnailId,
                webViewLink
            };
        } catch (error) {
            this.logOperation('error', `Failed to upload file: ${(error as Error).message}`);
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
     * @param accessToken - OAuth access token
     * @param blob - File contents as Blob
     * @param folderId - Target folder ID
     * @param name - File name
     * @param mimeType - MIME type of the file
     * @returns ID of the uploaded file
     */
    private async uploadFileToFolder(
        accessToken: string,
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
                    Authorization: `Bearer ${accessToken}`
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
     * @param accessToken - OAuth access token
     * @returns ID of the root folder
     */
    private async ensureRootFolder(accessToken: string): Promise<string> {
        // Check if the folder already exists
        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${this.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
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
                    Authorization: `Bearer ${accessToken}`,
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
     * @param accessToken - OAuth access token
     * @param parentId - Parent folder ID
     * @param performanceId - Performance identifier
     * @param performanceTitle - Performance title
     * @returns ID of the performance folder
     */
    private async ensurePerformanceFolder(
        accessToken: string,
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
                    Authorization: `Bearer ${accessToken}`
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
                    Authorization: `Bearer ${accessToken}`,
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
     * @param accessToken - OAuth access token
     * @param fileId - ID of the file
     * @param metadata - Metadata key-value pairs
     */
    private async addMetadataToFile(
        accessToken: string,
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
                    Authorization: `Bearer ${accessToken}`,
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
     * @param accessToken - OAuth access token
     * @param fileId - ID of the file
     * @returns Web view link or empty string if not found
     */
    private async getFileWebViewLink(accessToken: string, fileId: string): Promise<string> {
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
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
            return '';
        }
    }

    /**
     * Log operation for debugging and monitoring
     * @param level - Log level (start, progress, success, error, info)
     * @param message - Log message
     */
    private logOperation(level: 'start' | 'progress' | 'success' | 'error' | 'info', message: string): void {
        const timestamp = new Date().toISOString();
        const prefix = '[GoogleDriveService]';

        switch (level) {
            case 'start':
                console.log(`${timestamp} ${prefix} 🚀 ${message}`);
                break;
            case 'progress':
                console.log(`${timestamp} ${prefix} ⏳ ${message}`);
                break;
            case 'success':
                console.log(`${timestamp} ${prefix} ✅ ${message}`);
                break;
            case 'error':
                console.error(`${timestamp} ${prefix} ❌ ${message}`);
                break;
            case 'info':
                console.info(`${timestamp} ${prefix} ℹ️ ${message}`);
                break;
        }
    }
}

// Export a singleton instance
export const googleDriveService = new GoogleDriveService(); 