// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs';
import { getUserGoogleAuthClient } from '@/lib/googleAuth';
import { getGoogleRefreshToken, uploadToGoogleDrive } from '@/lib/clerkAuth';

/**
 * Ensure a folder exists in Google Drive, creating it if necessary
 */
async function ensureFolderExists(drive: any, name: string, parentId?: string): Promise<string> {
  console.log(`Ensuring folder exists: "${name}"${parentId ? ` in parent ${parentId}` : ''}`);
  
  try {
    // Check if folder already exists
    const query = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      console.log(`Found existing folder: "${name}" with ID: ${res.data.files[0].id}`);
      return res.data.files[0].id;
    }
    
    // Create folder if it doesn't exist
    console.log(`Creating new folder: "${name}"`);
    const folderMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };
    
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });
    
    console.log(`Created new folder: "${name}" with ID: ${folder.data.id}`);
    return folder.data.id;
  } catch (error) {
    console.error(`Error ensuring folder exists: "${name}"`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  console.log('Upload API called');
  
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      console.log('No authenticated user found');
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get request body
    const requestData = await request.json();
    console.log(`Upload request for recording: ${requestData.id}`);
    
    if (!requestData.id || !requestData.video || !requestData.metadata) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Extract recording data
    const { 
      id, 
      video, 
      thumbnail, 
      metadata, 
      performanceId, 
      performanceTitle, 
      rehearsalId 
    } = requestData;
    
    // Get Google refresh token from Clerk
    const refreshToken = await getGoogleRefreshToken(userId);
    
    if (!refreshToken) {
      console.log('No Google refresh token found');
      return NextResponse.json({
        success: false,
        message: 'Google Drive not connected. Please connect in settings.'
      });
    }
    
    // Upload to Google Drive
    try {
      console.log('Uploading to Google Drive...');
      const result = await uploadToGoogleDrive(
        refreshToken,
        video,
        thumbnail,
        {
          ...metadata,
          performanceId,
          performanceTitle,
          rehearsalId
        }
      );
      
      console.log('Upload successful:', result);
      return NextResponse.json({
        success: true,
        message: 'Recording uploaded to Google Drive',
        fileId: result.fileId,
        fileName: result.fileName,
        thumbnailId: result.thumbnailId
      });
    } catch (uploadError) {
      console.error('Error uploading to Google Drive:', uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
      return NextResponse.json(
        { 
          success: false, 
          message: `Google Drive upload failed: ${errorMessage}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in upload API:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Server error: ${errorMessage}`,
        error: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}