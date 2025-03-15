// components/VideoUpload.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Upload, File, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleDriveUpload } from '@/hooks/useGoogleDriveUpload';

interface VideoUploadProps {
  onVideoSelected: (
    videoUrl: string, 
    thumbnailUrl: string, 
    googleDriveVideoId: string, 
    googleDriveThumbnailId: string, 
    fileName?: string
  ) => void;
  onCancel: () => void;
  performanceId: string;
  rehearsalId: string;
  folderId: string; // Google Drive folder ID
}

export default function VideoUpload({ 
  onVideoSelected, 
  onCancel,
  performanceId,
  rehearsalId,
  folderId
}: VideoUploadProps) {
  const { user } = useAuth();
  const { uploadToGoogleDrive, isProcessing } = useGoogleDriveUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setSelectedFile(file);
    
    try {
      // Generate thumbnail
      const thumbnail = await generateThumbnail(file);
      setThumbnailBlob(thumbnail);
      setThumbnailUrl(URL.createObjectURL(thumbnail));
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setError('Failed to generate thumbnail');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !thumbnailBlob || !user) {
      setError('No file selected or user not authenticated');
      return;
    }
    
    setError(null);
    
    try {
      // Upload both video and thumbnail to Google Drive
      const result = await uploadToGoogleDrive(
        selectedFile, 
        thumbnailBlob, 
        folderId,
        {
          title: selectedFile.name,
          performanceId,
          rehearsalId,
          recordingId: `recording_${Date.now()}`
        }
      );
      
      // Pass URLs and IDs to the callback
      onVideoSelected(
        result.video.webContentLink || result.video.webViewLink, 
        result.thumbnail?.thumbnailLink || result.thumbnail?.webContentLink || '',
        result.video.id,
        result.thumbnail?.id || '',
        selectedFile.name
      );
    } catch (error) {
      console.error('Upload error:', error);
      setError(`Upload failed: ${(error as Error).message}`);
    }
  };

  // Generate a thumbnail from a video file
  const generateThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadeddata = () => {
        try {
          // Seek to 1 second
          video.currentTime = 1;
        } catch (e) {
          console.warn('Could not set video time', e);
        }
      };
      
      video.onseeked = () => {
        // Create canvas for thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not create thumbnail'));
            }
            
            // Clean up
            URL.revokeObjectURL(video.src);
          },
          'image/jpeg',
          0.7
        );
      };
      
      video.onerror = () => {
        reject(new Error('Error loading video'));
        URL.revokeObjectURL(video.src);
      };
      
      // Load the video file
      video.src = URL.createObjectURL(videoFile);
    });
  };

  return (
    <div className="bg-white rounded-lg p-6 max-w-lg mx-auto">
      <div className="flex items-center mb-6">
        <button 
          onClick={onCancel}
          className="mr-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold">Upload Video to Google Drive</h2>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="space-y-6">
        {!selectedFile ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Click to select a video file
            </p>
            <p className="mt-1 text-xs text-gray-500">
              MP4, MOV, or WebM formats
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center">
              <File className="text-blue-500 mr-2" />
              <span className="font-medium">{selectedFile.name}</span>
              <span className="ml-2 text-sm text-gray-500">
                ({Math.round(selectedFile.size / 1024 / 1024 * 10) / 10} MB)
              </span>
            </div>
            
            {thumbnailUrl && (
              <div>
                <p className="text-sm font-medium mb-2">Thumbnail Preview:</p>
                <img 
                  src={thumbnailUrl} 
                  alt="Video thumbnail" 
                  className="w-full max-w-xs mx-auto rounded-md"
                />
              </div>
            )}
            
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading to Google Drive...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full animate-pulse"
                    style={{ width: '100%' }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setThumbnailUrl(null);
                  setThumbnailBlob(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isProcessing}
              >
                {isProcessing ? 'Uploading to Drive...' : 'Upload to Google Drive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}