// lib/clerkAuth.ts
import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';
import { googleDriveService } from './GoogleDriveService';

// Add detailed logging
function logWithTimestamp(module: string, action: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][ClerkAuth][${module}][${action}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

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
        logWithTimestamp('TokenStorage', 'setToken', `Token saved to localStorage for user ${userId}`);
      }
    } catch (error) {
      logWithTimestamp('TokenStorage', 'ERROR', 'Error saving token to local storage', error);
    }
  },

  getToken: (userId: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(`google_token_${userId}`);
        logWithTimestamp('TokenStorage', 'getToken', `Token ${token ? 'found' : 'not found'} in localStorage for user ${userId}`);
        return token;
      }
    } catch (error) {
      logWithTimestamp('TokenStorage', 'ERROR', 'Error getting token from local storage', error);
    }
    return null;
  }
};

export async function createClerkUser(userInfo: GoogleUserInfo) {
  const { email, firstName, lastName, googleId, profileImageUrl } = userInfo;

  try {
    logWithTimestamp('UserCreation', 'start', `Creating/updating user for ${email}`);
    
    // Check if user already exists with this email
    const clerk = clerkClient;
    const { data: existingUsers } = await clerk.users.getUserList({
      emailAddress: [email],
    });

    logWithTimestamp('UserCreation', 'lookup', `Found ${existingUsers.length} existing users with email ${email}`);

    let user;

    if (existingUsers.length > 0) {
      // User exists, update their Google OAuth credentials if needed
      user = existingUsers[0];
      logWithTimestamp('UserCreation', 'existing', `Using existing user ${user.id}`);

      // Check if Google OAuth is already connected
      const hasGoogleAccount = user.externalAccounts?.some(
        (account: ExternalAccount) => account.provider === 'google' && account.identificationId === googleId
      );

      logWithTimestamp('UserCreation', 'oauth', `User has connected Google account: ${hasGoogleAccount}`);

      if (!hasGoogleAccount) {
        // Connect Google account to existing user
        logWithTimestamp('UserCreation', 'connect', `Connecting Google account to user ${user.id}`);
        await clerk.users.updateUser(user.id, {
          // Use appropriate update parameters as per Clerk API
          publicMetadata: {
            ...user.publicMetadata,
            googleId,
            hasGoogleAccount: true
          }
        });
      }
    } else {
      // Create a new user
      logWithTimestamp('UserCreation', 'new', `Creating new user with email ${email}`);
      user = await clerk.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        publicMetadata: {
          googleId,
          profileImageUrl
        }
      });
      logWithTimestamp('UserCreation', 'created', `Created new user with ID ${user.id}`);
    }

    // Create a new session token
    const sessionToken = randomBytes(32).toString('hex');
    logWithTimestamp('UserCreation', 'session', `Generated session token for user ${user.id}`);

    // Note: This part may need revision based on Clerk's current API for session creation
    // as createSession might not be available directly
    // Instead of create, use createSession if available, or simply generate a token
    // without creating an actual session in Clerk
    // (Your implementation might need to be adjusted based on your app's requirements)

    logWithTimestamp('UserCreation', 'complete', `Completed user creation/update process for ${user.id}`);
    return {
      userId: user.id,
      sessionToken,
      sessionId: sessionToken // Use the generated token as session ID 
    };
  } catch (error) {
    logWithTimestamp('UserCreation', 'ERROR', 'Error creating or updating Clerk user', error);
    throw error;
  }
}

export async function validateSession(sessionToken: string) {
  try {
    logWithTimestamp('Session', 'validate', `Validating session token`);
    const clerk = clerkClient;
    const { data: sessions } = await clerk.sessions.getSessionList({
      status: 'active',
    });

    logWithTimestamp('Session', 'lookup', `Found ${sessions.length} active sessions`);
    const session = sessions.find((s: any) => s.id === sessionToken);

    if (!session) {
      logWithTimestamp('Session', 'invalid', `No matching session found for token`);
      return null;
    }

    logWithTimestamp('Session', 'valid', `Found valid session for user ${session.userId}`);
    return {
      userId: session.userId,
      sessionId: session.id
    };
  } catch (error) {
    logWithTimestamp('Session', 'ERROR', 'Error validating session', error);
    return null;
  }
}

export async function saveGoogleToken(userId: string, refreshToken: string) {
  try {
    logWithTimestamp('GoogleToken', 'save', `Saving Google refresh token for user ${userId}`);
    
    // Store token in local storage (for client-side access)
    tokenStorage.setToken(userId, refreshToken);

    // Also try to store in Clerk's private metadata if secret key is available
    try {
      logWithTimestamp('GoogleToken', 'clerk', `Updating Clerk user metadata for ${userId}`);
      const clerk = clerkClient;
      await clerk.users.updateUser(userId, {
        privateMetadata: {
          googleRefreshToken: refreshToken,
          googleTokenUpdatedAt: new Date().toISOString(),
        },
      });
      logWithTimestamp('GoogleToken', 'clerk', `Successfully updated Clerk metadata for ${userId}`);
    } catch (error) {
      logWithTimestamp('GoogleToken', 'WARNING', 'Could not update Clerk user metadata', error);
    }

    return true;
  } catch (error) {
    logWithTimestamp('GoogleToken', 'ERROR', 'Error saving Google token', error);
    return false;
  }
}

export async function getGoogleRefreshToken(userId: string): Promise<string | null> {
  try {
    logWithTimestamp('GoogleToken', 'get', `Retrieving Google refresh token for user ${userId}`);
    
    // First try to get from local storage - this doesn't require the Clerk secret key
    const localToken = tokenStorage.getToken(userId);
    if (localToken) {
      logWithTimestamp('GoogleToken', 'localStorage', `Found refresh token in local storage for ${userId}`);
      return localToken;
    }

    // If not in local storage, try to get from Clerk if possible
    try {
      logWithTimestamp('GoogleToken', 'clerk', `Checking Clerk metadata for token`);
      const clerk = clerkClient;
      const user = await clerk.users.getUser(userId);

      // Check for Google OAuth token in user's private metadata
      const privateMetadata = user.privateMetadata as any;
      const refreshToken = privateMetadata?.googleRefreshToken ||
        privateMetadata?.google_refresh_token;

      if (refreshToken) {
        logWithTimestamp('GoogleToken', 'clerk', `Found refresh token in Clerk metadata for ${userId}`);
        // Cache it in local storage for next time
        tokenStorage.setToken(userId, refreshToken);
        return refreshToken;
      }
      
      logWithTimestamp('GoogleToken', 'clerk', `No token found in Clerk metadata for ${userId}`);
    } catch (clerkError) {
      logWithTimestamp('GoogleToken', 'WARNING', 'Could not get user from Clerk API', clerkError);
    }

    logWithTimestamp('GoogleToken', 'missing', `No Google refresh token found for user ${userId}`);
    return null;
  } catch (error) {
    logWithTimestamp('GoogleToken', 'ERROR', 'Error getting Google token', error);
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
    const clerk = clerkClient;
    const user = await clerk.users.getUser(userId);
    const privateMetadata = { ...(user.privateMetadata as any) };

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
    const result = await googleDriveService.uploadFile(
      refreshToken,
      videoBlob,
      metadata,
      thumbnailBlob || undefined
    );

    return {
      success: true,
      fileId: result.fileId,
      fileName: result.fileName,
      thumbnailId: result.thumbnailId
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
}
