import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Cache clients by userId to avoid recreating them
const clientCache: Record<string, OAuth2Client> = {};

/**
 * Get a Google Auth client for a specific user
 * @param userId - The user's ID
 * @param refreshToken - The user's refresh token
 */
export async function getUserGoogleAuthClient(userId: string, refreshToken: string): Promise<OAuth2Client> {
  // Check if we already have a client for this user
  if (clientCache[userId]) {
    return clientCache[userId];
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing Google OAuth credentials in environment variables');
      throw new Error('Missing Google OAuth credentials');
    }

    if (!refreshToken) {
      throw new Error('User does not have a Google refresh token');
    }

    // Create a new OAuth client
    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Set the refresh token
    client.setCredentials({
      refresh_token: refreshToken,
    });

    // Try to refresh the token to verify it works
    try {
      await client.getAccessToken();
    } catch (refreshError) {
      console.error(`Failed to refresh access token for user ${userId}`, refreshError);
      throw new Error(`Invalid refresh token for user: ${(refreshError as Error).message}`);
    }

    // Cache the client
    clientCache[userId] = client;
    return client;
  } catch (error) {
    console.error(`Error creating Google auth client for user ${userId}:`, error);
    throw new Error(`Google Auth failed: ${(error as Error).message}`);
  }
}

/**
 * For backwards compatibility - uses the environment token
 * This should eventually be removed in favor of always using user tokens
 */
export async function getGoogleAuthClient(): Promise<OAuth2Client> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !redirectUri || !refreshToken) {
      console.error('Missing Google OAuth credentials in environment variables');
      throw new Error('Missing Google OAuth credentials');
    }

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    client.setCredentials({ refresh_token: refreshToken });
    
    return client;
  } catch (error) {
    console.error('Error initializing Google auth client:', error);
    throw new Error(`Google Auth initialization failed: ${(error as Error).message}`);
  }
}

/**
 * Generate an authorization URL for the Google OAuth flow
 */
export function generateAuthUrl(): string {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Google OAuth credentials');
    }

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
      prompt: 'consent' // Force to get a new refresh token
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
} 