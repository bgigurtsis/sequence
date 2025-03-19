import { createClerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

// Create a Clerk client using the secret key
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * Get Google OAuth tokens for a user - single source of truth
 */
export async function getGoogleTokens(userId: string) {
    try {
        // Step 1: Try getting tokens from Clerk's OAuth API (primary source)
        const tokenResponse = await clerkClient.users.getUserOauthAccessToken(userId, 'oauth_google');

        if (tokenResponse.data && tokenResponse.data.length > 0) {
            return {
                accessToken: tokenResponse.data[0].token,
                refreshToken: null, // Clerk manages refresh tokens internally
                source: 'clerk_oauth_api'
            };
        }

        // Step 2: Try getting tokens from user's external accounts
        const user = await clerkClient.users.getUser(userId);
        const googleAccount = user.externalAccounts.find(
            (account: { provider: string }) => account.provider === 'google'
        );

        if (googleAccount) {
            // Use type assertion for external account properties
            const typedAccount = googleAccount as any;

            const accessToken =
                typedAccount.access_token ||
                typedAccount.accessToken ||
                typedAccount.token;

            const refreshToken =
                typedAccount.refresh_token ||
                typedAccount.refreshToken;

            if (accessToken) {
                return {
                    accessToken,
                    refreshToken,
                    source: 'clerk_external_account'
                };
            }
        }

        // Step 3: Client-side fallback (cookies)
        // Note: This should only be used in client components
        const tokenCookie = cookies().get('google_access_token');
        if (tokenCookie?.value) {
            return {
                accessToken: tokenCookie.value,
                refreshToken: cookies().get('google_refresh_token')?.value || null,
                source: 'cookies'
            };
        }

        // No tokens found
        return {
            accessToken: null,
            refreshToken: null,
            source: null
        };
    } catch (error) {
        console.error('Error getting Google OAuth tokens:', error);
        throw new Error('Failed to retrieve Google access tokens');
    }
}

/**
 * Store Google tokens (primarily for client-side use)
 */
export function storeGoogleTokens(accessToken: string, refreshToken?: string) {
    cookies().set('google_access_token', accessToken, {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600 // 1 hour
    });

    if (refreshToken) {
        cookies().set('google_refresh_token', refreshToken, {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 30 * 24 * 60 * 60 // 30 days
        });
    }
}

/**
 * Clear stored Google tokens
 */
export function clearGoogleTokens() {
    cookies().delete('google_access_token');
    cookies().delete('google_refresh_token');
} 