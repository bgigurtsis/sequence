// lib/clerkAuth.ts
import { clerkClient } from '@clerk/backend';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';
import { User, Session, ExternalAccount as ClerkExternalAccount } from '@clerk/backend/dist/types/api';
import { Clerk } from '@clerk/nextjs/server';

interface GoogleUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  googleId: string;
  profileImageUrl: string;
}

interface ExternalAccount {
  provider: string;
  identificationId: string;
}

// A simple local storage manager for tokens
const tokenStorage = {
  setToken: (userId: string, token: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`google_token_${userId}`, token);
      }
    } catch (error) {
      console.error('Error saving token to local storage:', error);
    }
  },
  
  getToken: (userId: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(`google_token_${userId}`);
      }
    } catch (error) {
      console.error('Error getting token from local storage:', error);
    }
    return null;
  }
};

export async function createClerkUser(userInfo: GoogleUserInfo) {
  const { email, firstName, lastName, googleId, profileImageUrl } = userInfo;
  
  try {
    // Check if user already exists with this email
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    let user;
    
    if (existingUsers.data.length > 0) {
      // User exists, update their Google OAuth credentials if needed
      user = existingUsers.data[0];
      
      // Check if Google OAuth is already connected
      const hasGoogleAccount = user.externalAccounts.some(
        (account: ExternalAccount) => account.provider === 'google' && account.identificationId === googleId
      );
      
      if (!hasGoogleAccount) {
        // Connect Google account to existing user
        await clerkClient.users.updateUser(user.id, {
          externalAccounts: [
            ...user.externalAccounts,
            {
              provider: 'google',
              providerUserId: googleId
            }
          ]
        });
      }
    } else {
      // Create a new user
      user = await clerkClient.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        publicMetadata: {
          googleId,
          profileImageUrl
        }
      });
    }

    // Create a new session token
    const sessionToken = randomBytes(32).toString('hex');
    const session = await clerkClient.sessions.createSession({
      userId: user.id,
      expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return {
      userId: user.id,
      sessionToken,
      sessionId: session.id
    };
  } catch (error) {
    console.error('Error creating or updating Clerk user:', error);
    throw error;
  }
}

export async function validateSession(sessionToken: string) {
  try {
    const sessions = await clerkClient.sessions.getSessionList({
      status: 'active',
    });
    
    const session = sessions.data.find((s: Session) => s.id === sessionToken);
    
    if (!session) {
      return null;
    }
    
    return {
      userId: session.userId,
      sessionId: session.id
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

export async function saveGoogleToken(userId: string, refreshToken: string) {
  try {
    // Store token in local storage (for client-side access)
    tokenStorage.setToken(userId, refreshToken);
    
    // Also try to store in Clerk's private metadata if secret key is available
    try {
      await clerkClient.users.updateUser(userId, {
        privateMetadata: {
          googleRefreshToken: refreshToken,
          googleTokenUpdatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn('Could not update Clerk user metadata, continuing with local storage only:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving Google token:', error);
    return false;
  }
}

export async function getGoogleRefreshToken(userId: string): Promise<string | null> {
  try {
    // First try to get from local storage - this doesn't require the Clerk secret key
    const localToken = tokenStorage.getToken(userId);
    if (localToken) {
      console.log("Found refresh token in local storage");
      return localToken;
    }
    
    // If not in local storage, try to get from Clerk if possible
    try {
      const user = await clerkClient.users.getUser(userId);
      
      // Check for Google OAuth token in user's private metadata
      const privateMetadata = user.privateMetadata as any;
      const refreshToken = privateMetadata?.googleRefreshToken || 
                          privateMetadata?.google_refresh_token;
      
      if (refreshToken) {
        console.log("Found refresh token in user metadata");
        // Cache it in local storage for next time
        tokenStorage.setToken(userId, refreshToken);
        return refreshToken;
      }
    } catch (clerkError) {
      console.warn('Could not get user from Clerk API, continuing with local storage only:', clerkError);
    }
    
    console.log("No Google refresh token found for user");
    return null;
  } catch (error) {
    console.error('Error getting Google token:', error);
    return null;
  }
}

// Check if token exists
export async function checkGoogleRefreshToken(userId: string): Promise<boolean> {
  const token = await getGoogleRefreshToken(userId);
  return !!token;
}

// Remove token
export async function removeGoogleRefreshToken(userId: string): Promise<boolean> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = {...(user.privateMetadata as any)};
    
    if (privateMetadata.googleRefreshToken) {
      delete privateMetadata.googleRefreshToken;
      await clerkClient.users.updateUser(userId, {
        privateMetadata,
      });
    }
    return true;
  } catch (error) {
    console.error('Error removing Google refresh token:', error);
    throw error;
  }
}

// Add this function to handle Google access token retrieval
async function getGoogleAccessToken(refreshToken: string): Promise<{ access_token: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google access token');
  }

  return response.json();
}

export async function uploadToGoogleDrive(
  refreshToken: string,
  videoBlob: Blob,
  thumbnailBlob: Blob | null,
  metadata: any
) {
  try {
    // Get an access token using the refresh token
    const { access_token } = await getGoogleAccessToken(refreshToken);
    
    if (!access_token) {
      throw new Error('Failed to get Google access token');
    }
    
    console.log('Got access token, uploading to Google Drive...');
    
    // Create a root folder for the app if it doesn't exist
    const rootFolderId = await ensureRootFolder(access_token);
    
    // Create a folder for this performance if needed
    const performanceFolderId = await ensurePerformanceFolder(
      access_token, 
      rootFolderId, 
      metadata.performanceId,
      metadata.performanceTitle || 'Untitled Performance'
    );
    
    // Prepare file name with basic metadata
    const fileName = `${metadata.title || 'Recording'} - ${metadata.time || new Date().toLocaleTimeString()}`;
    
    // Upload the video file
    const videoFileId = await uploadFile(
      access_token,
      videoBlob,
      performanceFolderId,
      fileName,
      'video/mp4'
    );
    
    // Upload the thumbnail if available
    let thumbnailId = null;
    if (thumbnailBlob) {
      thumbnailId = await uploadFile(
        access_token,
        thumbnailBlob,
        performanceFolderId,
        `${fileName} - Thumbnail`,
        'image/jpeg'
      );
    }
    
    // Add metadata as properties to the file
    if (videoFileId) {
      await addMetadataToFile(access_token, videoFileId, metadata);
    }
    
    return {
      success: true,
      fileId: videoFileId,
      fileName: fileName,
      thumbnailId: thumbnailId
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
}

// Helper function to upload a file to Google Drive
async function uploadFile(
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

// Helper to ensure a root folder exists for all the app's files
async function ensureRootFolder(accessToken: string): Promise<string> {
  const appFolderName = 'StageVault Recordings';
  
  // Check if the folder already exists
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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
    return searchData.files[0].id;
  }
  
  // If folder doesn't exist, create it
  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: appFolderName,
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

// Helper to ensure a folder exists for a specific performance
async function ensurePerformanceFolder(
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
    return searchData.files[0].id;
  }
  
  // If folder doesn't exist, create it
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

// Helper to add metadata as properties to a file
async function addMetadataToFile(
  accessToken: string,
  fileId: string,
  metadata: any
): Promise<void> {
  // Convert metadata to properties (strings only)
  const properties: Record<string, string> = {};
  
  // Add each metadata field as a property, converting non-strings to strings
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        properties[key] = JSON.stringify(value);
      } else {
        properties[key] = String(value);
      }
    }
  }
  
  // Update the file with the properties
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to add metadata to file: ${response.status} ${errorText}`);
    // Continue even if metadata addition fails - the file is already uploaded
  }
}
