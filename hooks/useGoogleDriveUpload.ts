// hooks/useGoogleDriveUpload.ts
// This replaces the complex sync service with a simpler approach

import { useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface Metadata {
  title?: string;
  description?: string;
  performanceId?: string;
  rehearsalId?: string;
}

interface GoogleDriveResponse {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
}

export function useGoogleDriveUpload() {
  /**
   * Uploads a video blob to Google Drive
   */
  const uploadVideoToGoogleDrive = async (videoBlob: Blob, metadata?: Metadata): Promise<GoogleDriveResponse> => {
    try {
      // Convert blob to base64
      const base64 = await blobToBase64(videoBlob);
      
      // Call the Firebase Function
      const uploadToGoogleDrive = httpsCallable(functions, 'uploadToGoogleDrive');
      const result = await uploadToGoogleDrive({
        fileData: base64,
        fileName: `video_${Date.now()}.webm`,
        mimeType: videoBlob.type || 'video/webm',
        metadata: {
          ...metadata,
          type: 'video'
        }
      });
      
      return result.data as GoogleDriveResponse;
    } catch (error) {
      console.error('Error uploading video to Google Drive:', error);
      throw error;
    }
  };

  /**
   * Uploads a thumbnail blob to Google Drive
   */
  const uploadThumbnailToGoogleDrive = async (thumbnailBlob: Blob, metadata?: Metadata): Promise<GoogleDriveResponse> => {
    try {
      // Convert blob to base64
      const base64 = await blobToBase64(thumbnailBlob);
      
      // Call the Firebase Function
      const uploadToGoogleDrive = httpsCallable(functions, 'uploadToGoogleDrive');
      const result = await uploadToGoogleDrive({
        fileData: base64,
        fileName: `thumbnail_${Date.now()}.jpg`,
        mimeType: thumbnailBlob.type || 'image/jpeg',
        metadata: {
          ...metadata,
          type: 'thumbnail'
        }
      });
      
      return result.data as GoogleDriveResponse;
    } catch (error) {
      console.error('Error uploading thumbnail to Google Drive:', error);
      throw error;
    }
  };

  /**
   * Uploads both video and thumbnail to Google Drive
   */
  const uploadToGoogleDrive = async (videoBlob: Blob, thumbnailBlob: Blob | null, metadata: Metadata) => {
    try {
      const videoResponse = await uploadVideoToGoogleDrive(videoBlob, metadata);
      
      let thumbnailResponse = null;
      if (thumbnailBlob) {
        thumbnailResponse = await uploadThumbnailToGoogleDrive(thumbnailBlob, metadata);
      }
      
      return {
        video: videoResponse,
        thumbnail: thumbnailResponse
      };
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      throw error;
    }
  };

  /**
   * Deletes a file from Google Drive
   */
  const deleteFromGoogleDrive = async (params: {
    type: 'performance' | 'rehearsal' | 'recording';
    performanceId?: string;
    rehearsalId?: string;
    recordingId?: string;
    recordingTitle?: string;
  }) => {
    try {
      const deleteFromGoogleDrive = httpsCallable(functions, 'deleteFromGoogleDrive');
      const result = await deleteFromGoogleDrive(params);
      return result.data;
    } catch (error) {
      console.error('Error deleting from Google Drive:', error);
      throw error;
    }
  };

  // Helper function to convert a blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = base64String.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return {
    uploadVideoToGoogleDrive,
    uploadThumbnailToGoogleDrive,
    uploadToGoogleDrive,
    deleteFromGoogleDrive
  };
} 