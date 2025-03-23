import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleRefreshToken } from '@/lib/clerkAuth';
import { uploadToGoogleDrive } from '@/lib/clerkAuth';

// Set a reasonable timeout for large uploads
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('Upload request received');

    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const recordingId = formData.get('recordingId') as string;
    const performanceId = formData.get('performanceId') as string;
    const performanceTitle = formData.get('performanceTitle') as string;
    const videoBlob = formData.get('video') as Blob;
    const thumbnailBlob = formData.get('thumbnail') as Blob | null;
    const metadataString = formData.get('metadataString') as string;

    // Validate required fields
    if (!recordingId || !performanceId || !videoBlob) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata;
    try {
      metadata = JSON.parse(metadataString);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid metadata JSON' },
        { status: 400 }
      );
    }

    // Get Google refresh token
    const refreshToken = await getGoogleRefreshToken(userId);
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 400 }
      );
    }

    // Upload to Google Drive
    try {
      const result = await uploadToGoogleDrive(
        refreshToken,
        videoBlob,
        thumbnailBlob,
        {
          ...metadata,
          recordingId,
          performanceId,
          performanceTitle,
          userId
        }
      );

      return NextResponse.json({
        success: true,
        fileId: result.fileId,
        fileName: result.fileName,
        thumbnailId: result.thumbnailId
      });
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in upload endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}