import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/googleAuth';

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
    // Check for required environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
      console.error('Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable');
      return NextResponse.json({ 
        error: 'Google Drive API credentials not configured',
        details: 'Server environment is missing required configuration'
      }, { status: 500 });
    }
    
    // Get form data
    const formData = await request.formData();
    
    const video = formData.get('video') as File;
    const thumbnail = formData.get('thumbnail') as File;
    const performanceId = formData.get('performanceId') as string;
    const performanceTitle = formData.get('performanceTitle') as string;
    const rehearsalId = formData.get('rehearsalId') as string;
    const rehearsalTitle = formData.get('rehearsalTitle') as string;
    const recordingTitle = formData.get('recordingTitle') as string;
    
    console.log('Received upload request:', {
      performanceId,
      performanceTitle,
      rehearsalId,
      rehearsalTitle,
      recordingTitle,
      videoSize: video ? `${Math.round(video.size / 1024 / 1024 * 100) / 100}MB` : 'Not provided',
      thumbnailSize: thumbnail ? `${Math.round(thumbnail.size / 1024)}KB` : 'Not provided',
    });
    
    // Validate inputs
    if (!video || !thumbnail || !performanceId || !rehearsalId) {
      const missingFields = [];
      if (!video) missingFields.push('video');
      if (!thumbnail) missingFields.push('thumbnail');
      if (!performanceId) missingFields.push('performanceId');
      if (!rehearsalId) missingFields.push('rehearsalId');
      
      console.error('Missing required fields:', missingFields.join(', '));
      return NextResponse.json({ 
        error: 'Missing required fields', 
        missingFields 
      }, { status: 400 });
    }
    
    // Initialize Google Drive API
    console.log('Initializing Google Drive API');
    const auth = await getGoogleAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    
    // Setup folder structure: App Root > Performance > Rehearsal
    console.log('Setting up folder structure');
    
    // 1. Ensure root "Sequence App" folder exists
    const appFolderId = await ensureFolderExists(drive, 'Sequence App');
    
    // 2. Ensure performance folder exists inside app folder
    const performanceFolderName = `Performance - ${performanceTitle} (${performanceId})`;
    const performanceFolderId = await ensureFolderExists(drive, performanceFolderName, appFolderId);
    
    // 3. Ensure rehearsal folder exists inside performance folder
    const rehearsalFolderName = `Rehearsal - ${rehearsalTitle} (${rehearsalId})`;
    const rehearsalFolderId = await ensureFolderExists(drive, rehearsalFolderName, performanceFolderId);
    
    // Upload video file
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
        app: appFolderId,
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
    }
    
    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
    }, { status: 500 });
  }
} 