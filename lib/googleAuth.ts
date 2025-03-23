// lib/googleAuth.ts
import { googleDriveService } from './GoogleDriveService';
import { getGoogleRefreshToken } from './clerkAuth';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

// Cache clients by userId to avoid recreating them
const clientCache: Record<string, { client: OAuth2Client, timestamp: number }> = {};

// How long to cache clients before refreshing (15 minutes)
const CLIENT_CACHE_TTL = 15 * 60 * 1000;

/**
 * Get a Google Auth client for a specific user
 * @param userId - The user's ID
 */
export async function getUserGoogleAuthClient(userId: string): Promise<OAuth2Client> {
  try {
    // Get the refresh token for this user
    const refreshToken = await getGoogleRefreshToken(userId);

    if (!refreshToken) {
      throw new Error('No Google refresh token found for user');
    }

    // Create OAuth2 client with the appropriate credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google-callback`
    );

    // Set credentials using the refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    return oauth2Client;
  } catch (error) {
    console.error(`Error creating Google auth client for user ${userId}:`, error);
    throw new Error(`Google Auth failed: ${(error as Error).message}`);
  }
}

/**
 * @deprecated Use getUserGoogleAuthClient instead
 */
export async function getGoogleAuthClient(): Promise<OAuth2Client> {
  console.warn('getGoogleAuthClient is deprecated. Use getUserGoogleAuthClient instead.');
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing Google OAuth credentials in environment variables');
      throw new Error('Missing Google OAuth credentials');
    }

    if (!refreshToken) {
      console.warn('No refresh token in environment variables, Google Drive operations will likely fail');
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
 * Generate a Google OAuth URL for authentication and Drive access
 * @deprecated Use googleDriveService.generateAuthUrl() instead
 */
export function generateAuthUrl(): string {
  console.warn('generateAuthUrl is deprecated. Use googleDriveService.generateAuthUrl() instead.');
  return googleDriveService.generateAuthUrl();
}

/**
 * Exchange an authorization code for tokens
 * @param code - The authorization code from Google
 * @deprecated Use googleDriveService.exchangeCodeForTokens(code) instead
 */
export async function exchangeCodeForTokens(code: string) {
  console.warn('exchangeCodeForTokens is deprecated. Use googleDriveService.exchangeCodeForTokens(code) instead.');
  return googleDriveService.exchangeCodeForTokens(code);
}

/**
 * Get user info from Google
 * @param accessToken - The access token
 */
export async function getUserInfo(accessToken: string) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Google OAuth credentials in environment variables');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ access_token: accessToken });

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    return await oauth2.userinfo.get();
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}

/**
 * Clear the client cache for a user, forcing a new token refresh next time
 */
export function clearUserClientCache(userId: string): void {
  if (clientCache[userId]) {
    delete clientCache[userId];
    console.log(`Cleared client cache for user ${userId}`);
  }
}

/**
 * Clear all client caches
 */
export function clearAllClientCaches(): void {
  Object.keys(clientCache).forEach(key => {
    delete clientCache[key];
  });
  console.log('Cleared all client caches');
}