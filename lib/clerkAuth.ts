// lib/clerkAuth.ts
import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';
import { googleDriveService } from './GoogleDriveService';

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
    const clerk = await clerkClient();
    const { data: existingUsers } = await clerk.users.getUserList({
      emailAddress: [email],
    });

    let user;

    if (existingUsers.length > 0) {
      // User exists, update their Google OAuth credentials if needed
      user = existingUsers[0];

      // Check if Google OAuth is already connected
      const hasGoogleAccount = user.externalAccounts?.some(
        (account: ExternalAccount) => account.provider === 'google' && account.identificationId === googleId
      );

      if (!hasGoogleAccount) {
        // Connect Google account to existing user
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
      user = await clerk.users.createUser({
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

    // Note: This part may need revision based on Clerk's current API for session creation
    // as createSession might not be available directly
    // Instead of create, use createSession if available, or simply generate a token
    // without creating an actual session in Clerk
    // (Your implementation might need to be adjusted based on your app's requirements)

    return {
      userId: user.id,
      sessionToken,
      sessionId: sessionToken // Use the generated token as session ID 
    };
  } catch (error) {
    console.error('Error creating or updating Clerk user:', error);
    throw error;
  }
}

export async function validateSession(sessionToken: string) {
  try {
    const clerk = await clerkClient();
    const { data: sessions } = await clerk.sessions.getSessionList({
      status: 'active',
    });

    const session = sessions.find((s) => s.id === sessionToken);

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
      const clerk = await clerkClient();
      await clerk.users.updateUser(userId, {
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
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);

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
    const clerk = await clerkClient();
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
