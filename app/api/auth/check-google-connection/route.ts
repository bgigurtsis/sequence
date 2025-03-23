import { NextResponse } from 'next/server';
import { hasGoogleConnection } from '@/lib/clerkHelpers';

export async function GET() {
    try {
        const connected = await hasGoogleConnection();
        return NextResponse.json({ connected });
    } catch (error) {
        console.error('Error checking Google connection:', error);
        return NextResponse.json({ connected: false, error: 'Failed to check connection' }, { status: 500 });
    }
} 