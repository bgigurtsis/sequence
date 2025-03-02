// lib/clerkAuth.ts
import { clerkClient } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';
import { auth as getAuth } from '@clerk/nextjs';

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
        // Store both in localStorage (for client-side)
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
    
    if (existingUsers.length > 0) {
      // User exists, update their Google OAuth credentials if needed
      user = existingUsers[0];
      
      // Check if Google OAuth is already connected
      const hasGoogleAccount = user.externalAccounts.some(
        (account: ExternalAccount) => account.provider === 'google' && account.identificationId === googleId
      );
      
      if (!hasGoogleAccount) {
        // Connect Google account to existing user
        await clerkClient.users.createExternalAccount({
          userId: user.id,
          provider: 'google',
          providerUserId: googleId,
        });
      }
    } else {
      // Create a new user
      user = await clerkClient.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        externalAccounts: [
          {
            provider: 'google',
            providerUserId: googleId,
          }
        ],
        profileImageUrl
      });
    }

    // Create a new session for the user
    const sessionToken = randomBytes(32).toString('hex');
    const session = await clerkClient.sessions.createSession({
      userId: user.id,
      token: sessionToken,
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
    
    const session = sessions.find((s: any) => s.token === sessionToken);
    
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

// Updated saveGoogleToken to store in local storage too
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
      // If this fails due to missing secret key, just log it - we have the local storage backup
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
    console.error('Error getting Google refresh token:', error);
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
