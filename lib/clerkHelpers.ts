import { auth, clerkClient } from '@clerk/nextjs/server';

// Store Google tokens in Clerk user metadata
export async function storeGoogleTokens(googleTokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}): Promise<boolean> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    await clerkClient.users.updateUserMetadata(userId, {
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
export async function getGoogleTokens(): Promise<{
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
} | null> {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return null;
    }

    const user = await clerkClient.users.getUser(userId);
    
    // @ts-ignore - privateMetadata type might not be properly defined
    const googleTokens = user.privateMetadata?.googleTokens;
    
    return googleTokens || null;
  } catch (error) {
    console.error('Error getting Google tokens:', error);
    return null;
  }
}

// Check if user has connected their Google account
export async function hasGoogleConnection(): Promise<boolean> {
  const tokens = await getGoogleTokens();
  return !!tokens && !!tokens.access_token;
} 