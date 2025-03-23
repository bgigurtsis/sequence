// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import googleDriveService from '@/lib/googleDriveService';
import { getGoogleTokens } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication check
    const authResult = await auth();
    const userId = authResult?.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const rehearsalId = formData.get('rehearsalId') as string;
    const metadata = JSON.parse(formData.get('metadata') as string || '{}');

    // 3. Validate input
    if (!file || !rehearsalId) {
      return NextResponse.json(
        { error: 'Missing required fields: file and rehearsalId' },
        { status: 400 }
      );
    }

    // 4. Get Google tokens
    const { accessToken, refreshToken } = await getGoogleTokens(userId);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected', needsAuth: true },
        { status: 401 }
      );
    }

    // 5. Initialize Google Drive service
    await googleDriveService.initialize(accessToken, refreshToken || undefined);

    // 6. Process the file
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording-${timestamp}.${file.name.split('.').pop()}`;

    // 7. Upload to Google Drive
    const result = await googleDriveService.uploadRecording(
      rehearsalId,
      blob,
      filename,
      metadata
    );

    // 8. Return success response
    return NextResponse.json(result);

  } catch (error: any) {
    // 9. Standardized error handling
    console.error('Upload error:', error);

    const status = error.status || 500;
    const message = error.message || 'An unexpected error occurred';

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}