import { clerkClient } from '@clerk/nextjs/server';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

// Cache clients by userId to avoid recreating them
const clientCache: Record<string, { client: OAuth2Client, timestamp: number }> = {};

// How long to cache clients before refreshing (15 minutes)
const CLIENT_CACHE_TTL = 15 * 60 * 1000;

// Base delay for retry logic
const RETRY_BASE_DELAY_MS = 500;

/**
 * Add detailed logging with timestamps
 */
function logWithTimestamp(module: string, action: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][GoogleOAuthManager][${module}][${action}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Get Google OAuth access token from Clerk's token wallet
 * @param userId - The user's ID
 * @returns The access token or null if not found
 */
export async function getGoogleOAuthToken(userId: string): Promise<{ token: string | null; provider: string }> {
  try {
    logWithTimestamp('OAuth', 'getToken', `Retrieving Google OAuth token for user ${userId}`);
    
    // Get the token from Clerk's OAuth Token Wallet
    const tokensResponse = await clerkClient.users.getUserOauthAccessToken(userId, 'oauth_google');
    
    logWithTimestamp('OAuth', 'getToken', `Raw token response received`, { 
      responseType: typeof tokensResponse,
      isArray: Array.isArray(tokensResponse),
      hasData: tokensResponse && typeof tokensResponse === 'object' && 'data' in tokensResponse
    });
    
    // Case 1: Response is already a token array (as a string)
    if (typeof tokensResponse === 'string') {
      try {
        const parsedTokens = JSON.parse(tokensResponse);
        
        if (Array.isArray(parsedTokens) && parsedTokens.length > 0) {
          const tokenData = parsedTokens[0];
          logWithTimestamp('OAuth', 'getToken', `Parsed token from string for user ${userId}`, {
            provider: tokenData.provider,
            tokenPresent: !!tokenData.token
          });
          return { token: tokenData.token, provider: tokenData.provider || 'google' };
        }
        
        logWithTimestamp('OAuth', 'getToken', `No tokens found in parsed string for user ${userId}`);
        return { token: null, provider: 'google' };
      } catch (parseError) {
        logWithTimestamp('OAuth', 'ERROR', `Failed to parse tokens from string for user ${userId}`, {
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        return { token: null, provider: 'google' };
      }
    }
    
    // Case 2: Response is the direct array of tokens (not in a data property)
    if (Array.isArray(tokensResponse)) {
      if (tokensResponse.length === 0) {
        logWithTimestamp('OAuth', 'getToken', `Empty token array for user ${userId}`);
        return { token: null, provider: 'google' };
      }
      
      const tokenData = tokensResponse[0];
      logWithTimestamp('OAuth', 'getToken', `Found token in array for user ${userId}`, {
        provider: tokenData.provider,
        tokenPresent: !!tokenData.token
      });
      
      return { token: tokenData.token, provider: tokenData.provider || 'google' };
    }
    
    // Case 3: Traditional response with data property
    if (tokensResponse && typeof tokensResponse === 'object' && 'data' in tokensResponse) {
      // Handle the expected case with tokensResponse.data
      if (!tokensResponse.data || tokensResponse.data.length === 0) {
        logWithTimestamp('OAuth', 'getToken', `No OAuth tokens found in data property for user ${userId}`, {
          responseHasData: !!tokensResponse.data,
          response: JSON.stringify(tokensResponse)
        });
        return { token: null, provider: 'google' };
      }
      
      // Get the first (and usually only) token
      const tokenData = tokensResponse.data[0];
      
      // Ensure token data is valid
      if (!tokenData || !tokenData.provider) {
        logWithTimestamp('OAuth', 'getToken', `Invalid token data structure for user ${userId}`, {
          tokenData: JSON.stringify(tokenData)
        });
        return { token: null, provider: 'google' };
      }
      
      logWithTimestamp('OAuth', 'getToken', `Found Google OAuth token in data property for user ${userId}`, {
        provider: tokenData.provider,
        tokenPresent: !!tokenData.token
      });
      
      return { token: tokenData.token, provider: tokenData.provider };
    }
    
    // Case 4: Unrecognized response format
    logWithTimestamp('OAuth', 'getToken', `Unrecognized token response format for user ${userId}`, {
      responseType: typeof tokensResponse,
      responseKeys: tokensResponse && typeof tokensResponse === 'object' ? Object.keys(tokensResponse) : [],
      responsePreview: JSON.stringify(tokensResponse).slice(0, 200)
    });
    
    return { token: null, provider: 'google' };
  } catch (error) {
    // Enhanced error logging with detailed information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownErrorType';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    logWithTimestamp('OAuth', 'ERROR', `Error getting Google OAuth token for user ${userId}`, {
      userId,
      errorMessage,
      errorName,
      errorStack,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    });
    
    // Return detailed error information in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error details:', error);
    }
    
    return { token: null, provider: 'google' };
  }
}

/**
 * Check if a user has connected their Google account
 * @param userId - The user's ID
 * @returns Boolean indicating if Google is connected
 */
export async function isGoogleConnected(userId: string): Promise<boolean> {
  try {
    logWithTimestamp('OAuth', 'checkConnection', `Checking Google connection for user ${userId}`);
    
    // First try to get the token
    const tokenResult = await getGoogleOAuthToken(userId);
    
    // If we have a valid token, the user is connected
    if (tokenResult && tokenResult.token) {
      logWithTimestamp('OAuth', 'checkConnection', `User ${userId} has valid OAuth token`);
      return true;
    }
    
    // If no token in wallet, check if user has a Google OAuth connection
    try {
      const user = await clerkClient.users.getUser(userId);
      
      // Safely check for OAuth accounts
      if (!user.emailAddresses || user.emailAddresses.length === 0) {
        logWithTimestamp('OAuth', 'checkConnection', `User ${userId} has no email addresses`);
        return false;
      }
      
      const oauthAccounts = user.emailAddresses
        .filter(email => email.verification && email.verification.strategy === 'oauth_google')
        .length > 0;
      
      logWithTimestamp('OAuth', 'checkConnection', `User ${userId} OAuth accounts: ${oauthAccounts ? 'Yes' : 'No'}`);
      
      // User has OAuth accounts but no token - may need to reconnect
      if (oauthAccounts) {
        logWithTimestamp('OAuth', 'checkConnection', `User ${userId} has OAuth account but no token - might need reconnection`);
      }
      
      return false; // No token means not connected, even if OAuth accounts exist
    } catch (userError) {
      logWithTimestamp('OAuth', 'ERROR', `Error checking user OAuth accounts for ${userId}`, {
        error: userError instanceof Error ? userError.message : String(userError),
        stack: userError instanceof Error ? userError.stack : null
      });
      return false;
    }
  } catch (error) {
    // Enhanced error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logWithTimestamp('OAuth', 'ERROR', `Error checking Google connection for user ${userId}`, {
      userId,
      errorMessage,
      errorDetails: error instanceof Error ? error.stack : JSON.stringify(error)
    });
    return false;
  }
}

/**
 * Get detailed OAuth connection status for a user
 * This performs multiple checks to diagnose connection issues
 * @param userId - The user's ID
 * @returns Detailed status object with connection information
 */
export async function getOAuthConnectionStatus(userId: string): Promise<{
  hasToken: boolean;
  hasOAuthAccount: boolean;
  provider: string;
  tokenError?: string;
  needsReconnect: boolean;
}> {
  const checkId = Math.random().toString(36).substring(2, 8); // Create unique ID for this check
  
  try {
    logWithTimestamp('OAuth', 'connectionStatus', `Getting detailed OAuth status for user ${userId}`);
    
    // Check if user exists in Clerk
    let user;
    try {
      user = await clerkClient.users.getUser(userId);
    } catch (userError) {
      const errorMsg = userError instanceof Error ? userError.message : String(userError);
      
      logWithTimestamp('OAuth', 'ERROR', `Error getting user from Clerk: ${userId}`, userError);
      return {
        hasToken: false,
        hasOAuthAccount: false,
        provider: 'google',
        tokenError: 'Failed to retrieve user data',
        needsReconnect: true
      };
    }
    
    // Multiple ways to check for Google OAuth accounts:
    // 1. Check email addresses with oauth_google verification strategy
    const hasGoogleOAuthViaEmail = user.emailAddresses && user.emailAddresses.length > 0 
      ? user.emailAddresses.some(email => 
          email.verification && email.verification.strategy === 'oauth_google'
        )
      : false;
      
    // 2. Check external accounts for Google
    const hasGoogleOAuthViaExternalAccounts = user.externalAccounts && user.externalAccounts.length > 0
      ? user.externalAccounts.some(account => 
          account.provider === 'oauth_google' || account.provider === 'google'
        )
      : false;
    
    // Combine both checks
    const hasGoogleOAuth = hasGoogleOAuthViaEmail || hasGoogleOAuthViaExternalAccounts;
    
    logWithTimestamp('OAuth', 'connectionStatus', `User ${userId} OAuth detection:`, {
      hasGoogleOAuthViaEmail,
      hasGoogleOAuthViaExternalAccounts,
      finalResult: hasGoogleOAuth
    });
    
    // Check OAuth token in wallet
    let tokenResult;
    try {
      tokenResult = await getGoogleOAuthToken(userId);
    } catch (tokenError) {
      const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown token error';
      
      logWithTimestamp('OAuth', 'ERROR', `Error getting token for user ${userId}`, {
        error: errorMessage,
        stack: tokenError instanceof Error ? tokenError.stack : null
      });
      
      return {
        hasToken: false,
        hasOAuthAccount: hasGoogleOAuth,
        provider: 'google',
        tokenError: errorMessage,
        needsReconnect: hasGoogleOAuth // Only need to reconnect if there's a Google account
      };
    }
    
    // Ensure we have a valid token result
    if (!tokenResult) {
      logWithTimestamp('OAuth', 'connectionStatus', `Null token result for user ${userId}`);
      return {
        hasToken: false,
        hasOAuthAccount: hasGoogleOAuth,
        provider: 'google',
        tokenError: 'Invalid token response',
        needsReconnect: hasGoogleOAuth
      };
    }
    
    // Determine if reconnection is needed
    const needsReconnect = hasGoogleOAuth && !tokenResult.token;
    
    if (needsReconnect) {
      logWithTimestamp('OAuth', 'connectionStatus', `User ${userId} needs to reconnect Google OAuth`);
    }
    
    return {
      hasToken: !!tokenResult.token,
      hasOAuthAccount: hasGoogleOAuth,
      provider: tokenResult.provider || 'google', // Default to 'google' if provider is missing
      needsReconnect
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logWithTimestamp('OAuth', 'ERROR', `Error checking detailed OAuth status for user ${userId}`, {
      errorMessage,
      stack: error instanceof Error ? error.stack : null
    });
    
    return {
      hasToken: false,
      hasOAuthAccount: false,
      provider: 'google',
      tokenError: errorMessage,
      needsReconnect: true
    };
  }
}

/**
 * Get or refresh a Google OAuth token for a user
 * @param userId - The user's ID
 * @returns The access token
 */
export async function getOrRefreshGoogleToken(userId: string): Promise<string> {
  try {
    logWithTimestamp('OAuth', 'getOrRefresh', `Getting or refreshing OAuth token for user ${userId}`);
    
    // Try to get the token
    const { token } = await getGoogleOAuthToken(userId);
    
    if (!token) {
      // Check if the user has a Google account but no token
      const status = await getOAuthConnectionStatus(userId);
      
      if (status.hasOAuthAccount && !status.hasToken) {
        throw new Error('Google account exists but no valid token. User needs to reconnect.');
      } else if (!status.hasOAuthAccount) {
        throw new Error('No Google account connected.');
      } else {
        throw new Error('Failed to retrieve OAuth token.');
      }
    }
    
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithTimestamp('OAuth', 'ERROR', `Error getting or refreshing token for user ${userId}`, { error: errorMessage });
    throw error;
  }
}

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
    
    // Try to get token from our central getOrRefreshGoogleToken function
    const accessToken = await getOrRefreshGoogleToken(userId);
    
    // Create OAuth2 client with the appropriate credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google-callback`
    );
    
    // Set credentials using the access token
    oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    // Cache the client
    clientCache[userId] = {
      client: oauth2Client,
      timestamp: Date.now()
    };
    
    return oauth2Client;
  } catch (error) {
    // Check if we should retry
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRetryableError = 
      errorMessage.includes('network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('rate limit');
    
    if (isRetryableError && retryCount < 2) {
      logWithTimestamp('OAuth', 'retry', `Retrying token retrieval for user ${userId} (attempt ${retryCount + 1})`);
      
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
    
    logWithTimestamp('OAuth', 'ERROR', `Error creating Google auth client for user ${userId}`, { error: errorMessage });
    throw new Error(`Google Auth failed: ${errorMessage}`);
  }
}

/**
 * Disconnect Google from a user's account by removing the OAuth token
 * @param userId - The user's ID
 */
export async function disconnectGoogle(userId: string): Promise<void> {
  try {
    logWithTimestamp('OAuth', 'disconnect', `Attempting to disconnect Google for user ${userId}`);
    
    // Clear cached client if it exists
    if (clientCache[userId]) {
      delete clientCache[userId];
      logWithTimestamp('OAuth', 'disconnect', `Cleared client cache for user ${userId}`);
    }
    
    // Currently, Clerk doesn't provide an API to directly delete tokens
    // When a user disconnects their Google account through Clerk's UI,
    // the tokens are automatically deleted
    
    logWithTimestamp('OAuth', 'disconnect', `User ${userId} will need to use Clerk's UI to disconnect Google`);
    
    // Throw an error with clear instructions
    throw new Error('To disconnect Google, use the account settings page. Direct token deletion is not supported.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithTimestamp('OAuth', 'ERROR', `Error disconnecting Google for user ${userId}`, { error: errorMessage });
    throw error;
  }
}

/**
 * Generate an authorization URL for OAuth consent screen
 * 
 * @param sessionId - Optional sessionId for Clerk OAuth flow
 * @param userId - Optional userId for Clerk OAuth flow
 * @param reconnect - Whether this is a reconnect operation for Clerk OAuth
 * @param useClerkOAuth - Whether to use Clerk's built-in OAuth flow (if true) or direct Google OAuth (if false)
 * @returns URL for OAuth consent screen
 */
export function generateAuthUrl(
  sessionId?: string, 
  userId?: string, 
  reconnect: boolean = false,
  useClerkOAuth: boolean = true
): string {
  try {
    // If using Clerk's OAuth system and sessionId & userId are provided
    if (useClerkOAuth && sessionId && userId) {
      logWithTimestamp('OAuth', 'generateUrl', `Generating Clerk OAuth URL for user ${userId}`, { reconnect });
      
      // For Clerk's OAuth system, we redirect to their built-in connect account page
      const baseUrl = '/user/connect-account';
      const params = new URLSearchParams({
        provider: 'oauth_google',
        force: reconnect ? 'true' : 'false',
      });
      
      const authUrl = `${baseUrl}?${params.toString()}`;
      
      logWithTimestamp('OAuth', 'generateUrl', `Generated Clerk OAuth URL: ${authUrl}`);
      return authUrl;
    }
    
    // If using direct Google OAuth
    logWithTimestamp('OAuth', 'generateAuthUrl', 'Generating direct Google Auth URL');

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      const missingVars = [
        !CLIENT_ID ? 'CLIENT_ID' : null,
        !CLIENT_SECRET ? 'CLIENT_SECRET' : null,
        !REDIRECT_URI ? 'REDIRECT_URI' : null
      ].filter(Boolean);
      
      logWithTimestamp('OAuth', 'ERROR', 'Missing Google OAuth credentials in environment variables', { missingVars });
      throw new Error('Missing Google OAuth credentials in environment variables');
    }

    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Define the scopes we need
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force to always display consent screen to get refresh token
    });

    logWithTimestamp('OAuth', 'generateAuthUrl', 'Generated direct Google Auth URL', { 
      urlLength: url.length,
      urlStart: url.substring(0, 30) + '...'
    });
    
    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userIdInfo = userId ? `for user ${userId}` : '';
    logWithTimestamp('OAuth', 'ERROR', `Error generating OAuth URL ${userIdInfo}`, { error: errorMessage });
    throw new Error(`Failed to generate Google OAuth URL: ${errorMessage}`);
  }
}

/**
 * Clear the client cache for a user, forcing a new token refresh next time
 */
export function clearUserClientCache(userId: string): void {
  if (clientCache[userId]) {
    delete clientCache[userId];
    logWithTimestamp('OAuth', 'clearCache', `Cleared client cache for user ${userId}`);
  }
}

/**
 * Clear all client caches
 */
export function clearAllClientCaches(): void {
  Object.keys(clientCache).forEach(key => {
    delete clientCache[key];
  });
  logWithTimestamp('OAuth', 'clearCache', 'Cleared all client caches');
}

/**
 * Get user info from Google
 * @param accessToken - The access token
 */
export async function getUserInfo(accessToken: string) {
  try {
    logWithTimestamp('OAuth', 'userInfo', 'Getting user info from Google');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google-callback`;

    if (!clientId || !clientSecret) {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithTimestamp('OAuth', 'ERROR', `Error getting user info from Google`, { error: errorMessage });
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from OAuth consent
 * @returns Tokens object containing access_token and refresh_token
 */
export async function exchangeCodeForTokens(code: string) {
  try {
    logWithTimestamp('OAuth', 'exchangeCode', 'Exchanging code for tokens', { 
      codeLength: code ? code.length : 0,
      codeStart: code ? code.substring(0, 10) + '...' : null 
    });

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      const missingVars = [
        !CLIENT_ID ? 'CLIENT_ID' : null,
        !CLIENT_SECRET ? 'CLIENT_SECRET' : null,
        !REDIRECT_URI ? 'REDIRECT_URI' : null
      ].filter(Boolean);
      
      logWithTimestamp('OAuth', 'ERROR', 'Missing Google OAuth credentials in environment variables', { missingVars });
      throw new Error('Missing Google OAuth credentials in environment variables');
    }

    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    
    // Using getToken to exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    logWithTimestamp('OAuth', 'exchangeCode', 'Successfully exchanged code for tokens', {
      tokenType: tokens.token_type,
      scopes: tokens.scope?.split(' '),
      expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 'unknown'
    });
    
    return tokens;
  } catch (error) {
    logWithTimestamp('OAuth', 'ERROR', `Failed to exchange code for tokens: ${(error as Error).message}`, error);
    throw error;
  }
} 