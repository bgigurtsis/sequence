import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/googleAuth';

async function findFolder(drive: any, name: string, parentId?: string): Promise<string | null> {
  console.log(`Looking for folder: "${name}"${parentId ? ` in parent ${parentId}` : ''}`);
  
  try {
    const query = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    
    if (res.data.files && res.data.files.length > 0) {
      console.log(`Found folder: "${name}" with ID: ${res.data.files[0].id}`);
      return res.data.files[0].id;
    }
    
    console.log(`Folder not found: "${name}"`);
    return null;
  } catch (error) {
    console.error(`Error looking for folder: "${name}"`, error);
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  console.log('Delete API called');
  
  try {
    // Check for required environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
      console.error('Missing GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable');
      return NextResponse.json({ 
        error: 'Google Drive API credentials not configured',
        details: 'Server environment is missing required configuration'
      }, { status: 500 });
    }
    
    // Get request data
    const data = await request.json();
    console.log('Delete request data:', data);
    
    const { type, performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId, recordingTitle } = data;
    
    // Initialize Google Drive API
    console.log('Initializing Google Drive API');
    const auth = await getGoogleAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    
    // Find app root folder
    const appFolderId = await findFolder(drive, 'Sequence App');
    if (!appFolderId) {
      console.log('App root folder not found, nothing to delete');
      return NextResponse.json({ success: true, message: 'No files found to delete' });
    }
    
    switch (type) {
      case 'performance': {
        if (!performanceId || !performanceTitle) {
          return NextResponse.json({ error: 'Missing performanceId or performanceTitle' }, { status: 400 });
        }
        
        // Find performance folder
        const performanceFolderName = `Performance - ${performanceTitle} (${performanceId})`;
        const performanceFolderId = await findFolder(drive, performanceFolderName, appFolderId);
        
        if (performanceFolderId) {
          console.log(`Deleting performance folder: "${performanceFolderName}"`);
          await drive.files.delete({
            fileId: performanceFolderId,
          });
          console.log('Performance folder deleted successfully');
        } else {
          console.log('Performance folder not found, nothing to delete');
        }
        
        break;
      }
      
      case 'rehearsal': {
        if (!performanceId || !performanceTitle || !rehearsalId || !rehearsalTitle) {
          return NextResponse.json({ 
            error: 'Missing required parameters for rehearsal deletion',
            required: ['performanceId', 'performanceTitle', 'rehearsalId', 'rehearsalTitle'],
            received: { performanceId, performanceTitle, rehearsalId, rehearsalTitle }
          }, { status: 400 });
        }
        
        // Find performance folder
        const performanceFolderName = `Performance - ${performanceTitle} (${performanceId})`;
        const performanceFolderId = await findFolder(drive, performanceFolderName, appFolderId);
        
        if (performanceFolderId) {
          // Find rehearsal folder
          const rehearsalFolderName = `Rehearsal - ${rehearsalTitle} (${rehearsalId})`;
          const rehearsalFolderId = await findFolder(drive, rehearsalFolderName, performanceFolderId);
          
          if (rehearsalFolderId) {
            console.log(`Deleting rehearsal folder: "${rehearsalFolderName}"`);
            await drive.files.delete({
              fileId: rehearsalFolderId,
            });
            console.log('Rehearsal folder deleted successfully');
          } else {
            console.log('Rehearsal folder not found, nothing to delete');
          }
        } else {
          console.log('Performance folder not found, nothing to delete');
        }
        
        break;
      }
      
      case 'recording': {
        if (!performanceId || !performanceTitle || !rehearsalId || !rehearsalTitle || !recordingId || !recordingTitle) {
          return NextResponse.json({ 
            error: 'Missing required parameters for recording deletion',
            required: ['performanceId', 'performanceTitle', 'rehearsalId', 'rehearsalTitle', 'recordingId', 'recordingTitle'],
            received: { performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId, recordingTitle }
          }, { status: 400 });
        }
        
        // Find performance folder
        const performanceFolderName = `Performance - ${performanceTitle} (${performanceId})`;
        const performanceFolderId = await findFolder(drive, performanceFolderName, appFolderId);
        
        if (!performanceFolderId) {
          console.log('Performance folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        // Find rehearsal folder
        const rehearsalFolderName = `Rehearsal - ${rehearsalTitle} (${rehearsalId})`;
        const rehearsalFolderId = await findFolder(drive, rehearsalFolderName, performanceFolderId);
        
        if (!rehearsalFolderId) {
          console.log('Rehearsal folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        // Find recording files
        console.log(`Looking for recording files in rehearsal folder: "${recordingTitle}"`);
        const res = await drive.files.list({
          q: `'${rehearsalFolderId}' in parents and (name='${recordingTitle}.mp4' or name='${recordingTitle}_thumb.jpg') and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });
        
        if (res.data.files && res.data.files.length > 0) {
          console.log(`Found ${res.data.files.length} files to delete for recording: "${recordingTitle}"`);
          
          for (const file of res.data.files) {
            console.log(`Deleting file: "${file.name}" (${file.id})`);
            await drive.files.delete({
              fileId: file.id as string,
            });
          }
          
          console.log('Recording files deleted successfully');
        } else {
          console.log(`No files found for recording: "${recordingTitle}"`);
        }
        
        break;
      }
      
      default:
        return NextResponse.json({ error: `Invalid delete type: ${type}` }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete API error:', error);
    
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