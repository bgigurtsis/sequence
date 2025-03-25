// lib/googleAuth.ts
import { googleDriveService } from './GoogleDriveService';
import { getGoogleOAuthToken } from './clerkTokenManager';
import { getGoogleRefreshToken } from './clerkAuth'; // Keep for backwards compatibility during migration
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

// Cache clients by userId to avoid recreating them
const clientCache: Record<string, { client: OAuth2Client, timestamp: number }> = {};

// How long to cache clients before refreshing (15 minutes)
const CLIENT_CACHE_TTL = 15 * 60 * 1000;

// Define the base delay constant outside the function
const RETRY_BASE_DELAY_MS = 500;

/**
 * Get a Google Auth client for a specific user
 * @param userId - The user's ID
 * @param retryCount - Number of retries attempted (internal use)
 */
export async function getUserGoogleAuthClient(userId: string, retryCount = 0): Promise<OAuth2Client> {
  try {
    // Maximum number of retries
    const MAX_RETRIES = 2;
    
    // Check if we have a cached client that's still valid
    const cachedClient = clientCache[userId];
    if (cachedClient && Date.now() - cachedClient.timestamp < CLIENT_CACHE_TTL) {
      return cachedClient.client;
    }
    
    // Try to get token from Clerk's OAuth Token Wallet first
    const tokenResult = await getGoogleOAuthToken(userId);
    
    // Validate token result and token
    if (!tokenResult) {
      console.error(`No token result returned for user ${userId}`);
      throw new Error('Failed to retrieve OAuth token data');
    }
    
    const accessToken = tokenResult.token;
    
    // If we got a token from Clerk's wallet, use it
    if (accessToken) {
      console.log(`Using OAuth token from Clerk's Token Wallet for user ${userId}`);
      
      // Create OAuth2 client with the appropriate credentials
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google-callback`
      );
      
      // Set credentials using the access token from Clerk
      oauth2Client.setCredentials({
        access_token: accessToken
      });
      
      // Cache the client
      clientCache[userId] = {
        client: oauth2Client,
        timestamp: Date.now()
      };
      
      return oauth2Client;
    }
    
    // Now that Clerk OAuth token wallet is the source of truth, no need to fall back to legacy tokens
    // Just throw a clear error indicating the user needs to reconnect
    throw new Error('No Google access token available. User needs to reconnect their Google account.');
  } catch (error) {
    // Check if we should retry
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryableError = 
      errorMessage.includes('network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('rate limit');
    
    if (isRetryableError && retryCount < 2) {
      console.warn(`Retrying token retrieval for user ${userId} after error: ${errorMessage} (attempt ${retryCount + 1})`);
      
      // Exponential backoff: wait longer for each retry
      const backoffMs = Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      // Clear cache to force a fresh attempt
      if (clientCache[userId]) {
        delete clientCache[userId];
      }
      
      // Retry with incremented count
      return getUserGoogleAuthClient(userId, retryCount + 1);
    }
    
    console.error(`Error creating Google auth client for user ${userId}:`, error);
    throw new Error(`Google Auth failed: ${errorMessage}`);
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