// app/api-handlers/upload.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getGoogleRefreshToken, uploadToGoogleDrive } from '@/lib/clerkAuth';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * Handle generic upload requests
 */
export async function upload(request: NextRequest) {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    try {
        // Parse request body
        const body = await request.json();
        const { videoData, metadata } = body;

        if (!videoData) {
            return NextResponse.json(
                { error: 'Missing video data' },
                { status: 400 }
            );
        }

        // Get user's Google refresh token
        const refreshToken = await getGoogleRefreshToken(userId);

        if (!refreshToken) {
            return NextResponse.json(
                { error: 'Google Drive not connected' },
                { status: 400 }
            );
        }

        // Process video data (this is a simplified example)
        // In a real implementation, you'd need to decode the video data from base64 or fetch from URL
        const videoBlob = new Blob([]); // Placeholder

        // Upload to Google Drive
        const result = await googleDriveService.uploadFile(
            refreshToken,
            videoBlob,
            {
                ...metadata,
                userId
            }
        );

        return NextResponse.json({
            success: true,
            fileId: result.fileId,
            fileName: result.fileName
        });
    } catch (error: any) {
        throw error;
    }
}

/**
 * Handle form-based uploads with multipart/form-data
 */
export async function uploadForm(request: NextRequest) {
    const authResult = await auth();
    const userId = authResult.userId;

    if (!userId) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    try {
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
            throw uploadError;
        }
    } catch (error: any) {
        throw error;
    }
} 