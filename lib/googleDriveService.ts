import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Performance, Rehearsal, Recording } from '@/types';

class GoogleDriveService {
  private drive: any;
  private oauth2Client: OAuth2Client | null = null;
  private initialized: boolean = false;
  private rootFolderId: string | null = null;

  constructor() {
    this.drive = null;
  }

  async initialize(accessToken: string, refreshToken?: string): Promise<void> {
    try {
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

      // Create or find the root "StageVault" folder
      this.rootFolderId = await this.findOrCreateRootFolder();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  private async findOrCreateRootFolder(): Promise<string> {
    const folderName = 'StageVault';

    // Search for existing folder
    const response = await this.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create folder if it doesn't exist
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await this.drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });

    return folder.data.id;
  }

  async getPerformances(): Promise<Performance[]> {
    if (!this.initialized || !this.rootFolderId) {
      throw new Error('Google Drive service not initialized');
    }

    const response = await this.drive.files.list({
      q: `'${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
    });

    return response.data.files.map((file: any) => ({
      id: file.id,
      title: file.name,
      createdAt: new Date(file.createdTime).toISOString(),
      defaultPerformers: [],
      rehearsals: []
    }));
  }

  async createPerformance(name: string): Promise<Performance> {
    if (!this.initialized || !this.rootFolderId) {
      throw new Error('Google Drive service not initialized');
    }

    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [this.rootFolderId],
    };

    const folder = await this.drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, createdTime',
    });

    return {
      id: folder.data.id,
      title: folder.data.name,
      createdAt: new Date(folder.data.createdTime).toISOString(),
      defaultPerformers: [],
      rehearsals: []
    } as Performance;
  }

  async getRehearsals(performanceId: string): Promise<Rehearsal[]> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    const response = await this.drive.files.list({
      q: `'${performanceId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
    });

    return response.data.files.map((file: any) => ({
      id: file.id,
      title: file.name,
      performanceId,
      createdAt: new Date(file.createdTime).toISOString(),
      location: "",
      date: "",
      recordings: []
    }));
  }

  async createRehearsal(performanceId: string, name: string, location: string, date: string): Promise<Rehearsal> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    const folderMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [performanceId],
    };

    const folder = await this.drive.files.create({
      resource: folderMetadata,
      fields: 'id, name, createdTime',
    });

    return {
      id: folder.data.id,
      title: folder.data.name,
      performanceId,
      createdAt: new Date(folder.data.createdTime).toISOString(),
      location: location,
      date: date,
      recordings: []
    } as Rehearsal;
  }

  async getRecordings(rehearsalId: string): Promise<Recording[]> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    const response = await this.drive.files.list({
      q: `'${rehearsalId}' in parents and mimeType contains 'video/' and trashed=false`,
      fields: 'files(id, name, createdTime, description)',
      orderBy: 'createdTime desc',
    });

    return response.data.files.map((file: any) => {
      let metadata = {};
      try {
        metadata = file.description ? JSON.parse(file.description) : {};
      } catch (error) {
        console.error('Failed to parse recording metadata:', error);
      }

      return {
        id: file.id,
        name: file.name,
        rehearsalId,
        createdAt: new Date(file.createdTime).toISOString(),
        ...metadata,
      };
    });
  }

  async uploadRecording(
    rehearsalId: string,
    file: Blob,
    filename: string,
    metadata: Record<string, any>
  ): Promise<{ id: string; name: string }> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    const fileMetadata = {
      name: filename,
      parents: [rehearsalId],
      description: JSON.stringify(metadata),
    };

    const media = {
      mimeType: file.type,
      body: file,
    };

    const response = await this.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name',
    });

    return {
      id: response.data.id,
      name: response.data.name,
    };
  }

  async getRecordingUrl(fileId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    // Generate a temporary access URL for the file
    await this.drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const response = await this.drive.files.get({
      fileId: fileId,
      fields: 'webContentLink',
    });

    return response.data.webContentLink;
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Google Drive service not initialized');
    }

    await this.drive.files.delete({
      fileId: fileId,
    });
  }
}

export default new GoogleDriveService();
