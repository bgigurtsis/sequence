import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

// Initialize Firebase Admin
admin.initializeApp();

// Get the OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

/**
 * Gets a user's Google access token using their refresh token stored in Firestore
 */
export const getGoogleAccessToken = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to get a token'
    );
  }

  const userId = context.auth.uid;
  
  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.googleRefreshToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User has not connected Google Drive'
      );
    }
    
    // Initialize OAuth2 client
    const oauth2Client = getOAuth2Client();
    
    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Get new access token
    const tokenResponse = await oauth2Client.getAccessToken();
    
    if (!tokenResponse.token) {
      throw new functions.https.HttpsError(
        'internal',
        'Failed to get access token'
      );
    }
    
    return {
      accessToken: tokenResponse.token,
      expiryDate: tokenResponse.res?.data?.expiry_date
    };
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to get Google access token'
    );
  }
});

/**
 * Creates a folder in the user's Google Drive
 */
export const createGoogleDriveFolder = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to create folders'
    );
  }
  
  const { folderName, parentFolderId, metadata = {} } = data;
  const userId = context.auth.uid;
  
  if (!folderName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Folder name is required'
    );
  }
  
  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.googleRefreshToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User has not connected Google Drive'
      );
    }
    
    // Initialize OAuth2 client
    const oauth2Client = getOAuth2Client();
    
    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Prepare folder creation request
    const folderMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      properties: {
        appId: 'stagevault',
        ...metadata
      }
    };
    
    // Add parent folder if provided
    if (parentFolderId) {
      folderMetadata.parents = [parentFolderId];
    }
    
    // Create folder
    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name, webViewLink'
    });
    
    return {
      id: response.data.id,
      name: response.data.name,
      webViewLink: response.data.webViewLink
    };
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to create folder in Google Drive'
    );
  }
});

/**
 * Upload a file to Google Drive
 */
export const uploadToGoogleDrive = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to upload files'
    );
  }
  
  const { fileData, fileName, mimeType, folderId, metadata = {} } = data;
  const userId = context.auth.uid;
  
  if (!fileData || !fileName || !mimeType) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'File data, name, and MIME type are required'
    );
  }
  
  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.googleRefreshToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User has not connected Google Drive'
      );
    }
    
    // Initialize OAuth2 client
    const oauth2Client = getOAuth2Client();
    
    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // If we don't have a folder ID, make sure we have a StageVault folder
    let parentFolderId = folderId;
    
    if (!parentFolderId) {
      // Check if app folder already exists
      const folderQuery = await drive.files.list({
        q: `name='StageVault' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)'
      });
      
      if (folderQuery.data.files && folderQuery.data.files.length > 0) {
        parentFolderId = folderQuery.data.files[0].id;
      } else {
        // Create app folder
        const folderResponse = await drive.files.create({
          requestBody: {
            name: 'StageVault',
            mimeType: 'application/vnd.google-apps.folder',
            properties: {
              appId: 'stagevault'
            }
          },
          fields: 'id'
        });
        parentFolderId = folderResponse.data.id;
      }
    }
    
    // Remove data URL prefix if present
    const base64Data = fileData.includes('base64,') 
      ? fileData.split('base64,')[1] 
      : fileData;
    
    // Prepare file metadata
    const fileMetadata: any = {
      name: fileName,
      mimeType: mimeType,
      parents: [parentFolderId],
      properties: {
        appId: 'stagevault',
        userId: userId,
        ...metadata
      }
    };
    
    // Upload file
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: mimeType,
        body: Buffer.from(base64Data, 'base64')
      },
      fields: 'id, name, mimeType, webViewLink, webContentLink, thumbnailLink'
    });
    
    // Make file readable without authentication
    await drive.permissions.create({
      fileId: response.data.id as string,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
      thumbnailLink: response.data.thumbnailLink
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to upload file to Google Drive'
    );
  }
});

/**
 * Delete a file from Google Drive
 */
export const deleteFromGoogleDrive = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to delete files'
    );
  }
  
  const { fileId } = data;
  const userId = context.auth.uid;
  
  if (!fileId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'File ID is required'
    );
  }
  
  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.googleRefreshToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User has not connected Google Drive'
      );
    }
    
    // Initialize OAuth2 client
    const oauth2Client = getOAuth2Client();
    
    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: userData.googleRefreshToken
    });
    
    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Delete file
    await drive.files.delete({
      fileId: fileId
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to delete file from Google Drive'
    );
  }
});