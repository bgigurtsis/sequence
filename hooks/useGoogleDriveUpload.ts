// hooks/useGoogleDriveUpload.ts
// This uses the user's own Google Drive for storage

import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/contexts/AuthContext';
import { functions } from '@/lib/firebase';

interface Metadata {
  title?: string;
  description?: string;
  performanceId?: string;
  rehearsalId?: string;
  recordingId?: string;
}

interface GoogleDriveResponse {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

interface FolderResponse {
  id: string;
  name: string;
  webViewLink: string;
}

export function useGoogleDriveUpload() {
  const { user, isGoogleDriveConnected } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  
  /**
   * Creates a performance folder in the user's Google Drive
   */
  const createPerformanceFolder = useCallback(async (
    performanceName: string,
    performanceId: string,
    metadata?: Record<string, string>
  ): Promise<FolderResponse> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }
    
    if (!isGoogleDriveConnected) {
      throw new Error('Google Drive is not connected');
    }
    
    setIsProcessing(true);
    
    try {
      const createFolder = httpsCallable(functions, 'createGoogleDriveFolder');
      const result = await createFolder({
        folderName: `Performance: "${performanceName}"`,
        metadata: {
          type: 'performance',
          performanceId,
          ...metadata
        }
      });
      
      return result.data as FolderResponse;
    } catch (error) {
      console.error('Error creating performance folder:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isGoogleDriveConnected, functions]);
  
  /**
   * Creates a rehearsal folder inside a performance folder
   */
  const createRehearsalFolder = useCallback(async (
    rehearsalName: string,
    performanceFolderId: string,
    rehearsalId: string,
    performanceId: string,
    metadata?: Record<string, string>
  ): Promise<FolderResponse> => {
    if (!user) {
      throw new Error('User must be authenticated');
    }
    
    if (!isGoogleDriveConnected) {
      throw new Error('Google Drive is not connected');
    }
    
    setIsProcessing(true);
    
    try {
      const createFolder = httpsCallable(functions, 'createGoogleDriveFolder');
      const result = await createFolder({
        folderName: `Rehearsal: "${rehearsalName}"`,
        parentFolderId: performanceFolderId,
        metadata: {
          type: 'rehearsal',
          rehearsalId,
          performanceId,
          ...metadata
        }
      });
      
      return result.data as FolderResponse;
    } catch (error) {
      console.error('Error creating rehearsal folder:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isGoogleDriveConnected, functions]);
  
  /**
   * Uploads a video blob to the user's Google Drive
   */
  const uploadVideoToGoogleDrive = useCallback(async (
    videoBlob: Blob, 
    folderId: string, 
    metadata?: Metadata
  ): Promise<GoogleDriveResponse> => {
    if (!user) {
      throw new Error('User must be authenticated to upload to Google Drive');
    }
    
    if (!isGoogleDriveConnected) {
      throw new Error('Google Drive is not connected');
    }
    
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const base64 = await blobToBase64(videoBlob);
      
      // Call the Firebase Function
      const uploadToGoogleDrive = httpsCallable(functions, 'uploadToGoogleDrive');
      const result = await uploadToGoogleDrive({
        fileData: base64,
        fileName: `recording_${Date.now()}.webm`,
        mimeType: videoBlob.type || 'video/webm',
        folderId: folderId,
        metadata: {
          ...metadata,
          type: 'video',
          userId: user.uid
        }
      });
      
      return result.data as GoogleDriveResponse;
    } catch (error) {
      console.error('Error uploading video to Google Drive:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isGoogleDriveConnected, functions]);

  /**
   * Uploads a thumbnail blob to the user's Google Drive
   */
  const uploadThumbnailToGoogleDrive = useCallback(async (
    thumbnailBlob: Blob, 
    folderId: string, 
    metadata?: Metadata
  ): Promise<GoogleDriveResponse> => {
    if (!user) {
      throw new Error('User must be authenticated to upload to Google Drive');
    }
    
    if (!isGoogleDriveConnected) {
      throw new Error('Google Drive is not connected');
    }
    
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const base64 = await blobToBase64(thumbnailBlob);
      
      // Call the Firebase Function
      const uploadToGoogleDrive = httpsCallable(functions, 'uploadToGoogleDrive');
      const result = await uploadToGoogleDrive({
        fileData: base64,
        fileName: `thumbnail_${Date.now()}.jpg`,
        mimeType: thumbnailBlob.type || 'image/jpeg',
        folderId: folderId,
        metadata: {
          ...metadata,
          type: 'thumbnail',
          userId: user.uid
        }
      });
      
      return result.data as GoogleDriveResponse;
    } catch (error) {
      console.error('Error uploading thumbnail to Google Drive:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isGoogleDriveConnected, functions]);

  /**
   * Uploads both video and thumbnail to the user's Google Drive
   */
  const uploadToGoogleDrive = useCallback(async (
    videoBlob: Blob, 
    thumbnailBlob: Blob | null, 
    folderId: string,
    metadata: Metadata
  ) => {
    try {
      const videoResponse = await uploadVideoToGoogleDrive(videoBlob, folderId, metadata);
      
      let thumbnailResponse = null;
      if (thumbnailBlob) {
        thumbnailResponse = await uploadThumbnailToGoogleDrive(thumbnailBlob, folderId, metadata);
      }
      
      return {
        video: videoResponse,
        thumbnail: thumbnailResponse
      };
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      throw error;
    }
  }, [uploadVideoToGoogleDrive, uploadThumbnailToGoogleDrive]);

  /**
   * Deletes a file from Google Drive
   */
  const deleteFromGoogleDrive = useCallback(async (fileId: string) => {
    if (!user) {
      throw new Error('User must be authenticated');
    }
    
    if (!isGoogleDriveConnected) {
      throw new Error('Google Drive is not connected');
    }
    
    setIsProcessing(true);
    
    try {
      const deleteFile = httpsCallable(functions, 'deleteFromGoogleDrive');
      const result = await deleteFile({ fileId });
      return result.data;
    } catch (error) {
      console.error('Error deleting from Google Drive:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [user, isGoogleDriveConnected, functions]);

  // Helper function to convert a blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return {
    isProcessing,
    createPerformanceFolder,
    createRehearsalFolder,
    uploadVideoToGoogleDrive,
    uploadThumbnailToGoogleDrive,
    uploadToGoogleDrive,
    deleteFromGoogleDrive
  };
} 