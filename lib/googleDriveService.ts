import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GoogleDriveService {
  private drive;
  private oauth2Client;
  private rootFolderName = process.env.STAGEVAULT_ROOT_FOLDER_NAME || 'StageVault Recordings';
  private rootFolderId: string | null = null;

  constructor(accessToken: string, refreshToken?: string) {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  async initialize(): Promise<void> {
    try {
      this.rootFolderId = await this.getOrCreateRootFolder();
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      throw new Error('Failed to initialize Google Drive service');
    }
  }

  private async getOrCreateRootFolder(): Promise<string> {
    try {
      // Check if root folder exists
      const response = await this.drive.files.list({
        q: `name='${this.rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      // Create root folder if it doesn't exist
      const folderMetadata = {
        name: this.rootFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folder = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      return folder.data.id!;
    } catch (error) {
      console.error('Error getting or creating root folder:', error);
      throw error;
    }
  }

  async getPerformances(): Promise<{ id: string; name: string }[]> {
    if (!this.rootFolderId) {
      await this.initialize();
    }

    const response = await this.drive.files.list({
      q: `'${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    return response.data.files?.map(file => ({
      id: file.id!,
      name: file.name!,
    })) || [];
  }

  async createPerformance(name: string): Promise<{ id: string; name: string }> {
    if (!this.rootFolderId) {
      await this.initialize();
    }

    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [this.rootFolderId!],
    };

    const folder = await this.drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name',
    });

    return {
      id: folder.data.id!,
      name: folder.data.name!,
    };
  }

  async getRehearsals(performanceId: string): Promise<{ id: string; name: string }[]> {
    const response = await this.drive.files.list({
      q: `'${performanceId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)',
    });

    return response.data.files?.map(file => ({
      id: file.id!,
      name: file.name!,
    })) || [];
  }

  async createRehearsal(performanceId: string, name: string): Promise<{ id: string; name: string }> {
    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [performanceId],
    };

    const folder = await this.drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name',
    });

    return {
      id: folder.data.id!,
      name: folder.data.name!,
    };
  }

  async getRecordings(rehearsalId: string): Promise<{ id: string; name: string; mimeType: string; thumbnailLink?: string }[]> {
    const response = await this.drive.files.list({
      q: `'${rehearsalId}' in parents and mimeType contains 'video/' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, mimeType, thumbnailLink)',
    });

    return response.data.files?.map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      thumbnailLink: file.thumbnailLink || undefined,
    })) || [];
  }

  async uploadRecording(
    rehearsalId: string, 
    file: Buffer | Blob, 
    filename: string, 
    metadata: Record<string, any>
  ): Promise<{ id: string; name: string }> {
    // Upload video file
    const fileMetadata = {
      name: filename,
      parents: [rehearsalId],
    };

    const media = {
      mimeType: 'video/mp4',
      body: file instanceof Buffer ? file : file,
    };

    const uploadedFile = await this.drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name',
    });

    // Create metadata file
    const metadataFilename = `${filename.split('.')[0]}_metadata.json`;
    const metadataFileMetadata = {
      name: metadataFilename,
      parents: [rehearsalId],
    };

    const metadataMedia = {
      mimeType: 'application/json',
      body: JSON.stringify(metadata, null, 2),
    };

    await this.drive.files.create({
      requestBody: metadataFileMetadata,
      media: metadataMedia,
    });

    return {
      id: uploadedFile.data.id!,
      name: uploadedFile.data.name!,
    };
  }

  async getRecordingUrl(fileId: string): Promise<string> {
    // Get a direct download URL or streaming URL
    const file = await this.drive.files.get({
      fileId,
      fields: 'webContentLink,webViewLink',
    });

    // Return the appropriate link for video playback
    return file.data.webViewLink || '';
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({
      fileId,
    });
  }

  // Method to refresh the token if needed
  async refreshAccessToken(): Promise<string | null> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials.access_token || null;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }
} 