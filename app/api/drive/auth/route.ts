import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { getGoogleTokens } from '@/lib/clerkHelpers';

export async function GET() {
    try {
        const authResult = await auth();
        const userId = authResult?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const tokens = await getGoogleTokens();

        if (!tokens) {
            return NextResponse.json({ error: 'No Google tokens found' }, { status: 404 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);

        return NextResponse.json({ authenticated: true });
    } catch (error) {
        console.error('Google auth error:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
} 