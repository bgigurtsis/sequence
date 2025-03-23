import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { google } from 'googleapis';
import { getGoogleTokens } from '@/lib/clerkHelpers';

export async function POST(request: Request) {
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

        const { operation, params } = await request.json();

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Handle different operations
        switch (operation) {
            case 'listFiles':
                const response = await drive.files.list(params);
                return NextResponse.json({ files: response.data.files });
            // Add other operations as needed
        }
    } catch (error) {
        console.error('Drive operation error:', error);
        return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
    }
} 