import { createClerkClient } from '@clerk/nextjs/server';

// Create a Clerk client using the secret key
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function getTokens(userId: string) {
    try {
        const user = await clerkClient.users.getUser(userId);
        const googleAccount = user.externalAccounts.find(
            (account: { provider: string }) => account.provider === 'google'
        );

        if (!googleAccount) {
            return { accessToken: null, refreshToken: null };
        }

        try {
            // According to Clerk's API, we need to use the correct provider format
            const tokenResponse = await clerkClient.users.getUserOauthAccessToken(userId, 'oauth_google');

            // The response is a paginated resource
            if (tokenResponse.data && tokenResponse.data.length > 0) {
                return {
                    accessToken: tokenResponse.data[0].token,
                    refreshToken: null
                };
            }
        } catch (tokenError) {
            console.warn('Could not get token from Clerk API:', tokenError);
            // Continue to fallback methods
        }

        // Fallback: Try to get tokens from account properties
        // Use type assertion for all properties to be consistent
        const typedAccount = googleAccount as any;

        const accessToken =
            typedAccount.access_token ||
            typedAccount.accessToken ||
            typedAccount.token;

        const refreshToken =
            typedAccount.refresh_token ||
            typedAccount.refreshToken;

        return {
            accessToken,
            refreshToken
        };
    } catch (error) {
        console.error('Error getting user tokens:', error);
        throw new Error('Failed to retrieve Google access tokens');
    }
} 