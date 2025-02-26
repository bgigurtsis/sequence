// lib/clerkAuth.ts
import { clerkClient } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';

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

// Store Google tokens in user metadata
export async function saveGoogleToken(userId: string, refreshToken: string) {
  try {
    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        googleRefreshToken: refreshToken,
        googleTokenUpdatedAt: new Date().toISOString(),
      },
    });
    return true;
  } catch (error) {
    console.error('Error saving Google token:', error);
    throw error;
  }
}

// Get token from user metadata
export async function getGoogleRefreshToken(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = user.privateMetadata as any;
    return privateMetadata?.googleRefreshToken || null;
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
