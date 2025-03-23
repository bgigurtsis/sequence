/// <reference types="gapi" />
/// <reference types="gapi.client.drive" />

import { google } from 'googleapis';

export async function checkGoogleDriveConnection(refreshToken: string): Promise<boolean> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // With drive.file scope, we can't list all files, so instead:
    // 1. Try to create a test folder
    // 2. Then delete it if successful
    const testFolder = await drive.files.create({
      requestBody: {
        name: 'StageVault_ConnectionTest',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id'
    });

    if (testFolder && testFolder.data && testFolder.data.id) {
      // Successfully created folder, now delete it
      await drive.files.delete({
        fileId: testFolder.data.id
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking Google Drive connection:', error);
    return false;
  }
} 