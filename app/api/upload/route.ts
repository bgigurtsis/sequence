// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { getUserGoogleAuthClient } from '@/lib/googleAuth';

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

export async function POST(request: NextRequest) {
  console.log('Upload API called');
  
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'You must be logged in to upload files'
      }, { status: 401 });
    }
    
    // Get form data
    const formData = await request.formData();
    
    // Get files from form data
    const video = formData.get('video') as File;
    const thumbnail = formData.get('thumbnail') as File;
    const performanceTitle = formData.get('performanceTitle') as string;
    const rehearsalTitle = formData.get('rehearsalTitle') as string || 'Default Rehearsal';
    const recordingTitle = formData.get('recordingTitle') as string;
    
    if (!video || !thumbnail || !performanceTitle || !recordingTitle) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'Video, thumbnail, performance title, and recording title are required'
      }, { status: 400 });
    }
    
    console.log(`Uploading recording "${recordingTitle}" for performance "${performanceTitle}"`);
    
    // Initialize Google Drive API with user credentials
    console.log(`Initializing Google Drive API for user: ${userId}`);
    const oauth2Client = await getUserGoogleAuthClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Create folder structure - use "StageVault Recordings" as the root folder
    const rootFolderId = await ensureFolderExists(drive, "StageVault Recordings");
    const performanceFolderId = await ensureFolderExists(drive, performanceTitle, rootFolderId);
    const rehearsalFolderId = await ensureFolderExists(drive, rehearsalTitle, performanceFolderId);
    
    // Upload video
    console.log(`Uploading video: "${recordingTitle}.mp4"`);
    const videoArrayBuffer = await video.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    
    const videoResponse = await drive.files.create({
      requestBody: {
        name: `${recordingTitle}.mp4`,
        mimeType: 'video/mp4',
        parents: [rehearsalFolderId],
      },
      media: {
        mimeType: 'video/mp4',
        body: videoBuffer,
      },
      fields: 'id,name,webViewLink',
    });
    
    console.log(`Video uploaded with ID: ${videoResponse.data.id}`);
    
    // Upload thumbnail
    console.log(`Uploading thumbnail: "${recordingTitle}_thumb.jpg"`);
    const thumbnailArrayBuffer = await thumbnail.arrayBuffer();
    const thumbnailBuffer = Buffer.from(thumbnailArrayBuffer);
    
    const thumbnailResponse = await drive.files.create({
      requestBody: {
        name: `${recordingTitle}_thumb.jpg`,
        mimeType: 'image/jpeg',
        parents: [rehearsalFolderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: thumbnailBuffer,
      },
      fields: 'id,name,webViewLink',
    });
    
    console.log(`Thumbnail uploaded with ID: ${thumbnailResponse.data.id}`);
    
    // Return success response with file links
    return NextResponse.json({
      success: true,
      files: {
        video: {
          id: videoResponse.data.id,
          name: videoResponse.data.name,
          webViewLink: videoResponse.data.webViewLink,
        },
        thumbnail: {
          id: thumbnailResponse.data.id,
          name: thumbnailResponse.data.name,
          webViewLink: thumbnailResponse.data.webViewLink,
        },
      },
      folders: {
        root: rootFolderId,
        performance: performanceFolderId,
        rehearsal: rehearsalFolderId,
      }
    });
  } catch (error) {
    console.error('Upload API error:', error);
    
    // Extract and format error details
    let errorMessage = 'Unknown error';
    let errorDetails = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack,
      };
      
      // Check for Google API specific errors
      if (
        error.message.includes('invalid_grant') || 
        error.message.includes('token has been expired or revoked')
      ) {
        return NextResponse.json({
          error: 'Google Drive connection error',
          details: 'Your Google Drive connection has expired. Please reconnect in Settings.',
          code: 'GOOGLE_AUTH_ERROR'
        }, { status: 401 });
      }
    }
    
    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
    }, { status: 500 });
  }
}