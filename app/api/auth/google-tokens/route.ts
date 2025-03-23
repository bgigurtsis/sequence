import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { ExternalAccount } from '@clerk/nextjs/server';

interface GoogleTokens {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
}

export async function GET() {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);

        const googleAccount = user.externalAccounts.find(
            (account: ExternalAccount) => account.provider === 'google'
        );

        if (!googleAccount) {
            return NextResponse.json({ error: 'No Google account connected' }, { status: 404 });
        }

        // Cast the tokens to our interface
        const tokens = (user.privateMetadata.googleTokens || {}) as GoogleTokens;

        return NextResponse.json({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date
        });
    } catch (error) {
        console.error('Error fetching Google tokens:', error);
        return NextResponse.json({ error: 'Failed to get tokens' }, { status: 500 });
    }
} 