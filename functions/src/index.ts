import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google, drive_v3 } from 'googleapis';

admin.initializeApp();

// Import specific types for better TypeScript integration
type HttpsCallableContext = functions.https.CallableContext;

// Types for Google Drive functions
interface UploadToGoogleDriveData {
  fileData: string;
  fileName: string;
  mimeType?: string;
  metadata?: {
    title?: string;
    description?: string;
    performanceId?: string;
    rehearsalId?: string;
    type?: string;
  };
}

interface DeleteFromGoogleDriveData {
  type: 'performance' | 'rehearsal' | 'recording';
  performanceId?: string;
  performanceTitle?: string;
  rehearsalId?: string;
  rehearsalTitle?: string;
  recordingId?: string;
  recordingTitle?: string;
}

// Get user's Google access token
async function getGoogleAccessToken(userId: string) {
  try {
    // Get user from Firebase Auth
    const user = await admin.auth().getUser(userId);
    
    // Find Google provider data
    const googleProvider = user.providerData.find(
      provider => provider.providerId === 'google.com'
    );
    
    if (!googleProvider) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User not connected with Google'
      );
    }
    
    // For production, implement token refresh with OAuth
    // This is a simplified example - you'd need proper OAuth token refresh
    
    // Generate a custom token that can be used for Firebase auth
    const customToken = await admin.auth().createCustomToken(userId);
    
    return { accessToken: customToken };
  } catch (error) {
    console.error('Error getting Google token:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to get Google access token',
      error
    );
  }
}

// Helper: Ensure a folder exists in Google Drive, create if needed
async function ensureFolder(drive: drive_v3.Drive, name: string, parentId?: string | null) {
  try {
    // Search for existing folder
    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    // Return existing folder if found
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }
    
    // Create new folder if not found
    const folderMetadata: drive_v3.Schema$File = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };
    
    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id'
    });
    
    return folder.data.id;
  } catch (error) {
    console.error(`Error ensuring folder "${name}":`, error);
    throw error;
  }
}

// Upload to Google Drive
export const uploadToGoogleDrive = functions.https.onCall(async (request, context: HttpsCallableContext) => {
  // Explicitly type-check for auth
  if (!context || !context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required to upload files'
    );
  }

  // Cast request data to our expected type after validation
  const data = request.data as unknown as UploadToGoogleDriveData;
  
  if (!data.fileData || !data.fileName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'File data and file name are required'
    );
  }
  
  try {
    // Get Google access token for user
    const { accessToken } = await getGoogleAccessToken(context.auth.uid);
    
    // Initialize Google Drive API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });
    
    // Create folder structure
    // 1. Root folder
    const rootFolderName = 'StageVault Recordings';
    const rootFolderId = await ensureFolder(drive, rootFolderName);
    
    // 2. Performance folder
    const performanceFolderName = data.metadata?.performanceId 
      ? `Performance-${data.metadata.performanceId}` 
      : 'Untitled Performance';
    
    const performanceFolderId = await ensureFolder(
      drive, 
      performanceFolderName,
      rootFolderId
    );
    
    // 3. Rehearsal folder (if needed)
    let parentFolderId = performanceFolderId;
    if (data.metadata?.rehearsalId) {
      const rehearsalFolderName = `Rehearsal-${data.metadata.rehearsalId}`;
      const rehearsalFolderId = await ensureFolder(
        drive, 
        rehearsalFolderName,
        performanceFolderId
      );
      parentFolderId = rehearsalFolderId;
    }
    
    // Prepare file metadata
    const fileMetadata: drive_v3.Schema$File = {
      name: data.fileName,
      parents: parentFolderId ? [parentFolderId] : undefined,
      description: data.metadata?.description || ''
    };
    
    // Convert base64 to buffer
    const fileContent = Buffer.from(
      data.fileData.replace(/^data:[^;]+;base64,/, ''),
      'base64'
    );
    
    // Upload video file
    const fileResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: data.mimeType || 'video/mp4',
        body: fileContent
      },
      fields: 'id, webViewLink'
    });
    
    const fileId = fileResponse.data?.id;
    const webViewLink = fileResponse.data?.webViewLink;
    
    // Create record in Firestore
    const recordingRef = await admin.firestore().collection('recordings').add({
      title: data.metadata?.title || 'Untitled Recording',
      performanceId: data.metadata?.performanceId,
      rehearsalId: data.metadata?.rehearsalId,
      googleFileId: fileId,
      videoUrl: webViewLink,
      sourceType: 'uploaded',
      userId: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      fileId,
      recordingId: recordingRef.id,
      videoUrl: webViewLink
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to upload to Google Drive',
      error
    );
  }
});

// Find a folder by name
async function findFolder(drive: drive_v3.Drive, name: string, parentId?: string | null) {
  try {
    let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }
    
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding folder "${name}":`, error);
    throw error;
  }
}

// Delete from Google Drive
export const deleteFromGoogleDrive = functions.https.onCall(async (request, context: HttpsCallableContext) => {
  // Explicitly type-check for auth
  if (!context || !context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required to delete files'
    );
  }
  
  // Cast request data to our expected type after validation
  const data = request.data as unknown as DeleteFromGoogleDriveData;
  
  if (!data.type) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Type is required for deletion'
    );
  }
  
  try {
    // Get Google access token for user
    const { accessToken } = await getGoogleAccessToken(context.auth.uid);
    
    // Initialize Google Drive API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth });
    
    // Find root folder
    const rootFolderName = 'StageVault Recordings';
    const rootFolderId = await findFolder(drive, rootFolderName);
    
    if (!rootFolderId) {
      // Nothing to delete if root folder doesn't exist
      return { success: true, message: 'Nothing to delete' };
    }
    
    const { type } = data;
    
    switch (type) {
      case 'performance': {
        // Find and delete performance folder
        if (data.performanceTitle) {
          const performanceFolderId = await findFolder(
            drive, 
            data.performanceTitle,
            rootFolderId
          );
          
          if (performanceFolderId) {
            await drive.files.delete({
              fileId: performanceFolderId
            });
          }
        }
        
        break;
      }
      
      case 'rehearsal': {
        // Find performance folder
        if (data.performanceTitle) {
          const performanceFolderId = await findFolder(
            drive, 
            data.performanceTitle,
            rootFolderId
          );
          
          if (performanceFolderId && data.rehearsalTitle) {
            // Find and delete rehearsal folder
            const rehearsalFolderId = await findFolder(
              drive, 
              data.rehearsalTitle,
              performanceFolderId
            );
            
            if (rehearsalFolderId) {
              await drive.files.delete({
                fileId: rehearsalFolderId
              });
            }
          }
        }
        
        break;
      }
      
      case 'recording': {
        // Handle recording file and thumbnail deletion
        // Find performance folder
        if (data.performanceTitle) {
          const performanceFolderId = await findFolder(
            drive, 
            data.performanceTitle,
            rootFolderId
          );
          
          if (performanceFolderId && data.rehearsalTitle) {
            // Find rehearsal folder
            const rehearsalFolderId = await findFolder(
              drive, 
              data.rehearsalTitle,
              performanceFolderId
            );
            
            if (rehearsalFolderId && data.recordingTitle) {
              // Search for files matching the recording title
              const query = `'${rehearsalFolderId}' in parents and (name='${data.recordingTitle}.mp4' or name='${data.recordingTitle}_thumb.jpg') and trashed=false`;
              
              const res = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
              });
              
              if (res.data.files && res.data.files.length > 0) {
                // Delete each matching file
                for (const file of res.data.files) {
                  if (file.id) {
                    await drive.files.delete({
                      fileId: file.id
                    });
                  }
                }
              }
            }
          }
        }
        
        break;
      }
      
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Invalid delete type: ${type}`
        );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to delete from Google Drive',
      error
    );
  }
});