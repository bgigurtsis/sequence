'use server';

import { auth } from '@clerk/nextjs/server';
import { GoogleDriveServerService } from '../../lib/server/GoogleDriveServerService';
import { revalidatePath } from 'next/cache';

/**
 * Server action to list files from Google Drive
 * 
 * @param folderId Optional folder ID to list files from
 * @param pageSize Optional number of files to return
 * @returns Array of Google Drive files or error object
 */
export async function listDriveFiles(folderId?: string, pageSize: number = 100) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { error: 'Authentication required' };
    }
    
    const files = await GoogleDriveServerService.listFiles(
      userId,
      folderId,
      pageSize
    );
    
    return { files };
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Server action to create a folder in Google Drive
 * 
 * @param name The name of the folder to create
 * @param parentId Optional parent folder ID
 * @returns The created folder or error object
 */
export async function createDriveFolder(name: string, parentId?: string) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { error: 'Authentication required' };
    }
    
    const folder = await GoogleDriveServerService.createFolder(
      userId,
      name,
      parentId
    );
    
    // Revalidate the files listing path to reflect changes
    revalidatePath('/dashboard');
    
    return { folder };
  } catch (error) {
    console.error('Error creating Drive folder:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Server action to delete a file in Google Drive
 * 
 * @param fileId The ID of the file to delete
 * @returns Success status or error object
 */
export async function deleteDriveFile(fileId: string) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { error: 'Authentication required' };
    }
    
    await GoogleDriveServerService.deleteFile(userId, fileId);
    
    // Revalidate the files listing path to reflect changes
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting Drive file:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Server action to get file details from Google Drive
 * 
 * @param fileId The ID of the file to retrieve
 * @returns The file details or error object
 */
export async function getDriveFile(fileId: string) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return { error: 'Authentication required' };
    }
    
    const file = await GoogleDriveServerService.getFile(userId, fileId);
    
    return { file };
  } catch (error) {
    console.error('Error getting Drive file:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
} 