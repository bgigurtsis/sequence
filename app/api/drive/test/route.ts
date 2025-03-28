import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { log } from '@/lib/logging';
import { getUserGoogleAuthClient } from '@/lib/googleOAuthManager';
import { google, drive_v3 } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    log('drive-test', 'info', 'Running Google Drive test for user', { userId });
    
    // Get OAuth client for the user
    const oauthClient = await getUserGoogleAuthClient(userId);
    
    if (!oauthClient) {
      return NextResponse.json(
        { error: 'Failed to get Google OAuth client' },
        { status: 400 }
      );
    }
    
    // Create Drive client
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    
    // Test 1: Check API access
    log('drive-test', 'info', 'Test 1: Checking API access');
    const aboutInfo = await drive.about.get({
      fields: 'user,storageQuota'
    });
    
    // Test 2: Create a test folder
    log('drive-test', 'info', 'Test 2: Creating test folder');
    const folderMetadata: drive_v3.Schema$File = {
      name: 'Test_Folder_' + Date.now(),
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id,name'
    });
    
    if (!folder.data || !folder.data.id) {
      throw new Error('Failed to create test folder');
    }
    
    const folderId = folder.data.id;
    
    // Test 3: Create a small test file in that folder
    log('drive-test', 'info', 'Test 3: Creating test file in folder');
    const fileMetadata: drive_v3.Schema$File = {
      name: 'test_file_' + Date.now() + '.txt',
      parents: [folderId], // This is now a string array with no null/undefined
      mimeType: 'text/plain'
    };
    
    // Create a simple text file content
    const content = `This is a test file created at ${new Date().toISOString()}`;
    
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'text/plain',
        body: content
      },
      fields: 'id,name,webViewLink'
    });
    
    if (!file.data || !file.data.id) {
      throw new Error('Failed to create test file');
    }
    
    // Test 4: Clean up (delete the test file and folder)
    log('drive-test', 'info', 'Test 4: Cleaning up test resources');
    await drive.files.delete({
      fileId: file.data.id
    });
    
    await drive.files.delete({
      fileId: folderId
    });
    
    // Extract and safely handle potentially undefined values
    const userEmail = aboutInfo.data.user?.emailAddress || 'unknown';
    const storageUsage = aboutInfo.data.storageQuota?.usage
      ? Math.round(Number(aboutInfo.data.storageQuota.usage) / 1024 / 1024)
      : 0;
    const storageLimit = aboutInfo.data.storageQuota?.limit
      ? Math.round(Number(aboutInfo.data.storageQuota.limit) / 1024 / 1024) + ' MB'
      : 'Unlimited';
    
    // Return success result with all the details
    return NextResponse.json({
      success: true,
      tests: {
        apiAccess: {
          success: true,
          user: userEmail,
          storageUsage: `${storageUsage} MB`,
          storageLimit: storageLimit
        },
        folderCreation: {
          success: true,
          folderId: folderId,
          folderName: folder.data.name || 'unnamed folder'
        },
        fileUpload: {
          success: true,
          fileId: file.data.id,
          fileName: file.data.name || 'unnamed file',
          webViewLink: file.data.webViewLink || 'no link available'
        },
        cleanup: {
          success: true
        }
      }
    });
    
  } catch (error: any) {
    console.error('Google Drive test failed:', error);
    
    // Extract error details
    const errorDetails: Record<string, any> = {
      message: error.message,
      stack: error.stack,
    };
    
    // Handle response object if it exists
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.statusText = error.response.statusText;
      
      if (error.response.data && error.response.data.error) {
        errorDetails.googleError = error.response.data.error;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; 