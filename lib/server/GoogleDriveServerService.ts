import { clerkClient } from '@clerk/nextjs/server';

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
}

/**
 * Server-side Google Drive service
 * 
 * Uses Clerk's OAuth token wallet to access Google Drive API
 * This allows for server-side operations without needing to pass tokens to the client
 */
export class GoogleDriveServerService {
  /**
   * Gets the user's OAuth token for Google from Clerk
   * 
   * @param userId The Clerk user ID
   * @returns The OAuth access token for Google
   * @throws Error if no token is found or an error occurs
   */
  private static async getAccessToken(userId: string): Promise<string> {
    try {
      const oauthTokens = await clerkClient.users.getUserOauthAccessToken(
        userId, 
        'oauth_google'
      );
      
      if (!oauthTokens || oauthTokens.data.length === 0) {
        throw new Error('No Google OAuth connection found');
      }
      
      return oauthTokens.data[0].token;
    } catch (error) {
      console.error('Failed to get Google OAuth token:', error);
      throw new Error('Failed to get Google access token');
    }
  }

  /**
   * Creates a folder in Google Drive
   * 
   * @param userId The Clerk user ID
   * @param name The name of the folder to create
   * @param parentId Optional parent folder ID
   * @returns The created folder object
   */
  static async createFolder(
    userId: string,
    name: string,
    parentId?: string
  ): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken(userId);
    
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create folder:', errorText);
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Lists files in Google Drive, optionally from a specific folder
   * 
   * @param userId The Clerk user ID
   * @param folderId Optional folder ID to list files from
   * @param pageSize Optional limit on the number of files to return
   * @returns An array of Google Drive files
   */
  static async listFiles(
    userId: string,
    folderId?: string,
    pageSize: number = 100
  ): Promise<GoogleDriveFile[]> {
    const token = await this.getAccessToken(userId);
    
    let query = "trashed = false";
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }
    
    const params = new URLSearchParams({
      q: query,
      pageSize: pageSize.toString(),
      fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents)'
    });
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list files:', errorText);
      throw new Error(`Failed to list files: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.files || [];
  }
  
  /**
   * Gets a file from Google Drive by ID
   * 
   * @param userId The Clerk user ID
   * @param fileId The Google Drive file ID
   * @returns The file object
   */
  static async getFile(
    userId: string,
    fileId: string
  ): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken(userId);
    
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,webViewLink,thumbnailLink,createdTime,modifiedTime,size,parents'
    });
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get file ${fileId}:`, errorText);
      throw new Error(`Failed to get file: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Uploads a file to Google Drive
   * 
   * @param userId The Clerk user ID
   * @param file The file to upload (as Buffer or Blob)
   * @param fileName The name to give the file
   * @param mimeType The mime type of the file
   * @param folderId Optional folder ID to upload to
   * @returns The uploaded file object
   */
  static async uploadFile(
    userId: string,
    file: Buffer | Blob,
    fileName: string,
    mimeType: string,
    folderId?: string
  ): Promise<GoogleDriveFile> {
    const token = await this.getAccessToken(userId);
    
    // Create metadata for the file
    const metadata = {
      name: fileName,
      mimeType,
      ...(folderId && { parents: [folderId] })
    };
    
    // Create a multipart request
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    // Create the multipart request body
    const requestBody = [
      delimiter,
      'Content-Type: application/json\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`
    ].join('');
    
    // Convert the file to a buffer if it's not already
    let fileBuffer: Buffer;
    if (file instanceof Buffer) {
      fileBuffer = file;
    } else {
      // Handle Blob in browser environment
      // In Node.js, we'd use a different approach for blob-like objects
      if (typeof Blob !== 'undefined' && file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        // Handle any other types that might be passed
        throw new Error('Unsupported file type. Must be Buffer or Blob.');
      }
    }
    
    // Combine the parts into a single body
    const multipartRequestBody = Buffer.concat([
      Buffer.from(requestBody, 'utf8'),
      fileBuffer,
      Buffer.from(closeDelimiter, 'utf8')
    ]);
    
    // Upload the file
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': multipartRequestBody.length.toString()
        },
        body: multipartRequestBody
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to upload file:', errorText);
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Deletes a file from Google Drive
   * 
   * @param userId The Clerk user ID
   * @param fileId The Google Drive file ID to delete
   * @returns True if the file was deleted successfully
   */
  static async deleteFile(userId: string, fileId: string): Promise<boolean> {
    const token = await this.getAccessToken(userId);
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to delete file ${fileId}:`, errorText);
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
    
    return true;
  }
} 