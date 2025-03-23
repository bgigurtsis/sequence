import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Here you would revoke the Google OAuth token
        // This might involve calling Clerk's API to revoke access

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting from Google Drive:', error);
        return NextResponse.json({ error: 'Failed to disconnect from Google Drive' }, { status: 500 });
    }
} 