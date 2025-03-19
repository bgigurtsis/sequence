// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getTokens } from '@/lib/getUserTokens';
import googleDriveService from '@/lib/googleDriveService';

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const rehearsalId = formData.get('rehearsalId') as string;
    const metadata = JSON.parse(formData.get('metadata') as string || '{}');

    if (!file || !rehearsalId) {
      return NextResponse.json(
        { error: 'File and rehearsalId are required' },
        { status: 400 }
      );
    }

    // Get user's Google tokens from Clerk metadata
    const { accessToken, refreshToken } = await getTokens(user.id);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 401 }
      );
    }

    // Initialize Google Drive service with user's token
    await googleDriveService.initialize(accessToken, refreshToken);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording-${timestamp}.${file.name.split('.').pop()}`;

    // Convert File to Blob for uploading
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Upload the recording
    const result = await googleDriveService.uploadRecording(
      rehearsalId,
      blob,
      filename,
      metadata
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload recording' },
      { status: 500 }
    );
  }
}