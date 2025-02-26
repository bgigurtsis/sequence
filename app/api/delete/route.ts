// app/api/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { getUserGoogleAuthClient } from '@/lib/googleAuth';

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
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'You must be logged in to delete files'
      }, { status: 401 });
    }
    
    // Get request data
    const data = await request.json();
    console.log('Delete request data:', data);
    
    const { type, performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId, recordingTitle } = data;
    
    // Initialize Google Drive API with user credentials
    console.log(`Initializing Google Drive API for user: ${userId}`);
    const oauth2Client = await getUserGoogleAuthClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Find root folder - using StageVault Recordings
    const rootFolderId = await findFolder(drive, "StageVault Recordings");
    if (!rootFolderId) {
      console.log('Root folder not found, nothing to delete');
      return NextResponse.json({ success: true, message: 'No files found to delete' });
    }
    
    // Handle different delete types
    switch (type) {
      case 'performance': {
        // Find and delete performance folder
        console.log(`Looking for performance folder: "${performanceTitle}"`);
        const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId);
        
        if (!performanceFolderId) {
          console.log('Performance folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        console.log(`Deleting performance folder: "${performanceTitle}" (${performanceFolderId})`);
        await drive.files.delete({
          fileId: performanceFolderId,
        });
        
        console.log('Performance folder deleted successfully');
        break;
      }
      
      case 'rehearsal': {
        // Find performance folder
        console.log(`Looking for performance folder: "${performanceTitle}"`);
        const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId);
        
        if (!performanceFolderId) {
          console.log('Performance folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        // Find and delete rehearsal folder
        console.log(`Looking for rehearsal folder: "${rehearsalTitle}"`);
        const rehearsalFolderId = await findFolder(drive, rehearsalTitle, performanceFolderId);
        
        if (!rehearsalFolderId) {
          console.log('Rehearsal folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        console.log(`Deleting rehearsal folder: "${rehearsalTitle}" (${rehearsalFolderId})`);
        await drive.files.delete({
          fileId: rehearsalFolderId,
        });
        
        console.log('Rehearsal folder deleted successfully');
        break;
      }
      
      case 'recording': {
        // Find performance folder
        console.log(`Looking for performance folder: "${performanceTitle}"`);
        const performanceFolderId = await findFolder(drive, performanceTitle, rootFolderId);
        
        if (!performanceFolderId) {
          console.log('Performance folder not found, nothing to delete');
          return NextResponse.json({ success: true, message: 'No files found to delete' });
        }
        
        // Find rehearsal folder
        const rehearsalFolderName = rehearsalTitle || 'Default Rehearsal';
        console.log(`Looking for rehearsal folder: "${rehearsalFolderName}"`);
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