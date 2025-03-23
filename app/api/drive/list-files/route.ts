import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { getGoogleTokens } from '@/lib/clerkHelpers';

export async function GET() {
    try {
        const tokens = await getGoogleTokens();

        if (!tokens?.access_token) {
            return NextResponse.json({ error: 'Not authenticated with Google' }, { status: 401 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const response = await drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, mimeType, createdTime)',
        });

        return NextResponse.json({ files: response.data.files });
    } catch (error) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
} 