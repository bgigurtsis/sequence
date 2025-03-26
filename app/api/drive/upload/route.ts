import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { googleDriveService } from '@/lib/GoogleDriveService';

/**
 * API route to handle file uploads to Google Drive
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null || file?.name;
    const mimeType = formData.get('mimeType') as string | null || file?.type;
    const folderId = formData.get('folderId') as string | null;
    
    // Validate the required fields
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }
    
    if (!mimeType) {
      return NextResponse.json(
        { error: 'MIME type is required' },
        { status: 400 }
      );
    }
    
    // Convert the file to an array buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload the file to Google Drive
    const uploadedFile = await googleDriveService.uploadFileWithBuffer(
      userId,
      fileBuffer,
      fileName,
      mimeType,
      folderId || undefined
    );
    
    // Return the uploaded file information
    return NextResponse.json({
      success: true,
      file: uploadedFile
    });
    
  } catch (error) {
    console.error('[DRIVE-UPLOAD-ERROR]', error);
    
    // Return an appropriate error response
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to upload file to Google Drive' 
      },
      { status: 500 }
    );
  }
} 