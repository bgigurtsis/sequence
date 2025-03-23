// lib/clerkAuth.ts

import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';

// Create a custom admin API client for Clerk operations
const clerk = {
  users: {
    getUserList: async (params: any) => {
      // Implementation using Clerk API directly
      const response = await fetch('https://api.clerk.dev/v1/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.json();
    },
    getUser: async (userId: string) => {
      // Implementation using Clerk API directly
      const response = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.json();
    },
    updateUser: async (userId: string, data: any) => {
      // Implementation using Clerk API directly
      const response = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    createUser: async (data: any) => {
      // Implementation using Clerk API directly
      const response = await fetch('https://api.clerk.dev/v1/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    }
  },
  sessions: {
    getSessionList: async (params: any) => {
      // Implementation using Clerk API directly
      const response = await fetch('https://api.clerk.dev/v1/sessions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.json();
    },
    createSession: async (data: any) => {
      // Implementation using Clerk API directly
      const response = await fetch('https://api.clerk.dev/v1/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    }
  }
};

// Define simplified interfaces (instead of importing Clerk's internal or deprecated ones)
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

interface ClerkUser {
  id: string;
  externalAccounts: ExternalAccount[];
  privateMetadata: Record<string, unknown>;
  publicMetadata?: Record<string, unknown>;
  // Add any other fields if necessary
}

interface ClerkSession {
  id: string;
  userId: string;
  expireAt?: Date;
  // Add any other fields if necessary
}

// If you need an OAuth token interface:
interface OauthAccessToken {
  provider: string;
  token: string;
  expiresAt?: Date;
  refreshToken?: string;
}

// A simple local storage manager for tokens (used only in a browser context)
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
  },
};

// Create or update a Clerk user via email/Google OAuth
export async function createClerkUser(userInfo: GoogleUserInfo) {
  const { email, firstName, lastName, googleId, profileImageUrl } = userInfo;

  try {
    // Check if user already exists with this email
    const existingUsers = await clerk.users.getUserList({
      emailAddress: [email],
    });

    let user: ClerkUser;

    if (existingUsers.length > 0) {
      // User exists, update their Google OAuth credentials if needed
      user = existingUsers[0] as ClerkUser;

      // Check if Google OAuth is already connected
      const hasGoogleAccount = user.externalAccounts.some(
        (account: ExternalAccount) =>
          account.provider === 'google' && account.identificationId === googleId
      );

      if (!hasGoogleAccount) {
        // Connect Google account to existing user
        await clerk.users.updateUser(user.id, {
          externalAccounts: [
            ...user.externalAccounts,
            {
              provider: 'google',
              providerUserId: googleId,
            },
          ],
        });
      }
    } else {
      // Create a new user
      user = (await clerk.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        publicMetadata: {
          googleId,
          profileImageUrl,
        },
      })) as ClerkUser;
    }

    // Create a new random token (not an official Clerk session token; just an example)
    const sessionToken = randomBytes(32).toString('hex');

    // Create a Clerk session (if you want Clerk to track user sessions)
    const session = (await clerk.sessions.createSession({
      userId: user.id,
      expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    })) as ClerkSession;

    return {
      userId: user.id,
      sessionToken,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Error creating or updating Clerk user:', error);
    throw error;
  }
}

// Validate a session by sessionId or custom token
export async function validateSession(sessionToken: string) {
  try {
    const sessions = await clerk.sessions.getSessionList({
      status: 'active',
    });

    // In newer Clerk versions, getSessionList returns an array directly. 
    // If older versions returned { data: [...] }, adjust as needed:
    const sessionList = Array.isArray(sessions) ? sessions : sessions || [];

    const session = sessionList.find((s: any) => s.id === sessionToken);
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return null;
  }
}

// Save Google refresh token for user (stores in localStorage and privateMetadata if possible)
export async function saveGoogleToken(userId: string, refreshToken: string) {
  try {
    // Store token in local storage (for client-side)
    tokenStorage.setToken(userId, refreshToken);

    // Also attempt storing in Clerk private metadata
    try {
      await clerk.users.updateUser(userId, {
        privateMetadata: {
          googleRefreshToken: refreshToken,
          googleTokenUpdatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn(
        'Could not update Clerk user metadata, continuing with local storage only:',
        error
      );
    }

    return true;
  } catch (error) {
    console.error('Error saving Google token:', error);
    return false;
  }
}

// Retrieve Google refresh token from localStorage or Clerk privateMetadata
export async function getGoogleRefreshToken(
  userId: string
): Promise<string | null> {
  try {
    // Check local storage first
    const localToken = tokenStorage.getToken(userId);
    if (localToken) {
      console.log('Found refresh token in local storage');
      return localToken;
    }

    // If not in local storage, try Clerk
    try {
      const user = (await clerk.users.getUser(userId)) as ClerkUser;
      const privateMetadata = user.privateMetadata || {};
      const refreshToken =
        (privateMetadata.googleRefreshToken as string) ||
        (privateMetadata.google_refresh_token as string);

      if (refreshToken) {
        console.log('Found refresh token in user metadata');
        // Cache it in local storage for next time
        tokenStorage.setToken(userId, refreshToken);
        return refreshToken;
      }
    } catch (clerkError) {
      console.warn(
        'Could not get user from Clerk API, continuing with local storage only:',
        clerkError
      );
    }

    console.log('No Google refresh token found for user');
    return null;
  } catch (error) {
    console.error('Error getting Google token:', error);
    return null;
  }
}

// Quick helper to check if a user's Google refresh token exists
export async function checkGoogleRefreshToken(userId: string): Promise<boolean> {
  const token = await getGoogleRefreshToken(userId);
  return !!token;
}

// Remove token from Clerk's private metadata (and optionally from localStorage)
export async function removeGoogleRefreshToken(userId: string): Promise<boolean> {
  try {
    const user = (await clerk.users.getUser(userId)) as ClerkUser;
    const privateMetadata = { ...user.privateMetadata };

    if (privateMetadata.googleRefreshToken) {
      delete privateMetadata.googleRefreshToken;
      await clerk.users.updateUser(userId, {
        privateMetadata,
      });
    }

    return true;
  } catch (error) {
    console.error('Error removing Google refresh token:', error);
    throw error;
  }
}

// Get a new access token from Google using a refresh token
async function getGoogleAccessToken(
  refreshToken: string
): Promise<{ access_token: string }> {
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

// Uploads both a video blob (and optionally a thumbnail) to Google Drive in a structured folder
export async function uploadToGoogleDrive(
  refreshToken: string,
  videoBlob: Blob,
  thumbnailBlob: Blob | null,
  metadata: Record<string, any>
) {
  try {
    // Get an access token using the refresh token
    const { access_token } = await getGoogleAccessToken(refreshToken);
    if (!access_token) {
      throw new Error('Failed to get Google access token');
    }

    console.log('Got access token, uploading to Google Drive...');

    // Ensure the app's root folder
    const rootFolderId = await ensureRootFolder(access_token);

    // Ensure a subfolder for this specific performance
    const performanceFolderId = await ensurePerformanceFolder(
      access_token,
      rootFolderId,
      metadata.performanceId,
      metadata.performanceTitle || 'Untitled Performance'
    );

    // Prepare file name
    const fileName = `${metadata.title || 'Recording'} - ${metadata.time || new Date().toLocaleTimeString()
      }`;

    // Upload the video
    const videoFileId = await uploadFile(
      access_token,
      videoBlob,
      performanceFolderId,
      fileName,
      'video/mp4'
    );

    // Upload the thumbnail
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

    // Add custom metadata to the uploaded video
    if (videoFileId) {
      await addMetadataToFile(access_token, videoFileId, metadata);
    }

    return {
      success: true,
      fileId: videoFileId,
      fileName: fileName,
      thumbnailId: thumbnailId,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
}

// Helper: upload a single file to Google Drive (multipart form request)
async function uploadFile(
  accessToken: string,
  blob: Blob,
  folderId: string,
  name: string,
  mimeType: string
): Promise<string> {
  const metadata = {
    name,
    mimeType,
    parents: [folderId],
  };

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
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

// Ensure a root folder (e.g. "StageVault Recordings") exists in Drive, or create if missing
async function ensureRootFolder(accessToken: string): Promise<string> {
  const appFolderName = 'StageVault Recordings';

  // Search for the folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error(`Failed to search for root folder: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // If not found, create the folder
  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create root folder: ${createResponse.status}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

// Ensure a folder for a given performance inside the root folder
async function ensurePerformanceFolder(
  accessToken: string,
  parentId: string,
  performanceId: string,
  performanceTitle: string
): Promise<string> {
  const folderName = `${performanceTitle} (${performanceId})`;

  // Search for the folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchResponse.ok) {
    throw new Error(`Failed to search for performance folder: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // If not found, create it
  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create performance folder: ${createResponse.status}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

// Attach custom metadata (key/value) to a file in Drive
async function addMetadataToFile(
  accessToken: string,
  fileId: string,
  metadata: Record<string, any>
): Promise<void> {
  const properties: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        properties[key] = JSON.stringify(value);
      } else {
        properties[key] = String(value);
      }
    }
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to add metadata to file: ${response.status} ${errorText}`);
    // The file upload was successful, so we won't throw here unless you specifically want to fail
  }
}

// Retrieve a user's connected OAuth providers
export async function getUserOAuthTokens(userId: string): Promise<ExternalAccount[]> {
  try {
    const user = (await clerk.users.getUser(userId)) as ClerkUser;
    return user.externalAccounts;
  } catch (error) {
    console.error('Error getting OAuth tokens:', error);
    return [];
  }
}