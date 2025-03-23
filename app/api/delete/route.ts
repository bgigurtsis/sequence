// app/api/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTokens } from '@/lib/getUserTokens';
import googleDriveService from '@/lib/googleDriveService';

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Get user's Google tokens from Clerk metadata
    const { accessToken, refreshToken } = await getTokens(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 401 }
      );
    }

    // Initialize Google Drive service with user's token
    await googleDriveService.initialize(accessToken, refreshToken);

    // Delete the file
    await googleDriveService.deleteFile(fileId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete file' },
      { status: 500 }
    );
  }
}