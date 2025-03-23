import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import type { ExternalAccount } from '@clerk/nextjs/server';

interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}

// Store Google tokens in Clerk user metadata
export async function storeGoogleTokens(googleTokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}): Promise<boolean> {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: {
        googleTokens,
      },
    });

    return true;
  } catch (error) {
    console.error('Error storing Google tokens:', error);
    return false;
  }
}

// Retrieve Google tokens from Clerk user metadata
export async function getGoogleTokens(): Promise<GoogleTokens | null> {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return null;
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    const googleAccount = user.externalAccounts.find(
      (account: ExternalAccount) => account.provider === 'google'
    );

    if (!googleAccount) {
      return null;
    }

    return (user.privateMetadata.googleTokens || {}) as GoogleTokens;
  } catch (error) {
    console.error('Error getting Google tokens:', error);
    return null;
  }
}

// Check if user has connected their Google account
export async function hasGoogleConnection(): Promise<boolean> {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return false;
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    return user.externalAccounts.some(
      (account: ExternalAccount) =>
        account.provider === 'google' && account.verification?.strategy === 'oauth_google'
    );
  } catch (error) {
    console.error('Error checking Google connection:', error);
    return false;
  }
}