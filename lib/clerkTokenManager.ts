import { clerkClient } from '@clerk/nextjs/server';
import { auth } from '@clerk/nextjs/server';

// Add detailed logging
function logWithTimestamp(module: string, action: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][ClerkTokenManager][${module}][${action}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
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
    
    // NEW: Handle different response formats
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
      responsePreview: JSON.stringify(tokensResponse).slice(0, 200) // Use slice which is safer
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
 * Migration function to move tokens from privateMetadata to Clerk's OAuth Token Wallet
 * This is meant to be run once per user during the transition
 * @param userId - The user's ID
 */
export async function migrateGoogleTokenToWallet(userId: string): Promise<boolean> {
  try {
    logWithTimestamp('Migration', 'start', `Migrating Google token for user ${userId}`);
    
    // First check if token already exists in wallet
    const { token: existingToken } = await getGoogleOAuthToken(userId);
    if (existingToken) {
      logWithTimestamp('Migration', 'skip', `Token already exists in wallet for user ${userId}`);
      return true;
    }
    
    // Get user data to check privateMetadata
    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = user.privateMetadata as any;
    
    // Check if token exists in privateMetadata
    const refreshToken = privateMetadata?.googleRefreshToken || privateMetadata?.google_refresh_token;
    
    if (!refreshToken) {
      logWithTimestamp('Migration', 'skip', `No token found in privateMetadata for user ${userId}`);
      return false;
    }
    
    // Token exists in privateMetadata but not in wallet, so we need to migrate
    // NOTE: Direct token creation in OAuth wallet is not supported by Clerk's API
    // This is a placeholder for the actual migration logic
    logWithTimestamp('Migration', 'notice', `Direct token migration not supported by Clerk API, user will need to reconnect Google`, {
      userId
    });
    
    return false;
  } catch (error) {
    logWithTimestamp('Migration', 'ERROR', `Error migrating token for user ${userId}`, error);
    return false;
  }
}

/**
 * Clean up legacy token storage after migration
 * @param userId - The user's ID
 */
export async function cleanupLegacyTokenStorage(userId: string): Promise<boolean> {
  try {
    logWithTimestamp('Cleanup', 'start', `Cleaning up legacy token storage for user ${userId}`);
    
    // Get user data
    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = { ...(user.privateMetadata as any) };
    
    // Check if legacy tokens exist
    const hasLegacyTokens = !!privateMetadata.googleRefreshToken || 
                           !!privateMetadata.google_refresh_token;
    
    if (!hasLegacyTokens) {
      logWithTimestamp('Cleanup', 'skip', `No legacy tokens found for user ${userId}`);
      return true;
    }
    
    // Remove legacy tokens
    if (privateMetadata.googleRefreshToken) {
      delete privateMetadata.googleRefreshToken;
    }
    if (privateMetadata.google_refresh_token) {
      delete privateMetadata.google_refresh_token;
    }
    
    // Update user
    await clerkClient.users.updateUser(userId, {
      privateMetadata
    });
    
    logWithTimestamp('Cleanup', 'success', `Removed legacy tokens for user ${userId}`);
    return true;
  } catch (error) {
    logWithTimestamp('Cleanup', 'ERROR', `Error cleaning up legacy tokens for user ${userId}`, error);
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
  try {
    logWithTimestamp('OAuth', 'connectionStatus', `Getting detailed OAuth status for user ${userId}`);
    
    // Check if user exists in Clerk
    let user;
    try {
      user = await clerkClient.users.getUser(userId);
    } catch (userError) {
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