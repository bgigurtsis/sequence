// components/VideoUpload.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Upload, Link, File, Check } from 'lucide-react';

interface VideoUploadProps {
  onVideoSelected: (videoBlob: Blob, thumbnailBlob: Blob) => void;
  onCancel: () => void;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onVideoSelected, onCancel }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'link'>('file');
  const [videoLink, setVideoLink] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }
    
    try {
      setIsUploading(true);
      setError(null);
      
      // Generate thumbnail from video file
      const thumbnailBlob = await generateThumbnail(file);
      
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 5;
        });
      }, 200);
      
      // Call the callback with file and thumbnail
      onVideoSelected(file, thumbnailBlob);
      
      // Finish progress
      clearInterval(interval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      
    } catch (err) {
      setError('Failed to process video file');
      setIsUploading(false);
      console.error(err);
    }
  };

  const generateThumbnail = (file: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const videoElement = document.createElement('video');
      videoElement.src = URL.createObjectURL(file);
      videoElement.muted = true;
      videoElement.playsInline = true;
      
      videoElement.addEventListener('loadedmetadata', () => {
        // If the video is shorter than 1 second, use half its duration
        const seekTime = videoElement.duration < 1 ? videoElement.duration / 2 : 1;
        videoElement.currentTime = seekTime;
      });
      
      videoElement.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((thumbnailBlob) => {
            if (thumbnailBlob) {
              resolve(thumbnailBlob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          }, 'image/jpeg', 0.7);
        } else {
          reject(new Error('Failed to create canvas context'));
        }
      });
      
      videoElement.addEventListener('error', () => {
        reject(new Error('Video error occurred'));
      });
    });
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLink.trim()) {
      setError('Please enter a valid video URL');
      return;
    }
    
    // Validate URL format - basic check
    try {
      new URL(videoLink);
      
      setIsUploading(true);
      setError(null);
      
      // For now, we'll use a placeholder thumbnail for external videos
      // In a real implementation, you might want to fetch the video and generate a thumbnail
      const placeholderCanvas = document.createElement('canvas');
      placeholderCanvas.width = 320;
      placeholderCanvas.height = 180;
      const ctx = placeholderCanvas.getContext('2d');
      
      if (ctx) {
        // Draw a placeholder thumbnail
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText('External Video', 110, 90);
        
        const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
          placeholderCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create thumbnail'));
          }, 'image/jpeg', 0.9);
        });
        
        // Now fetch the video from the URL
        const response = await fetch(videoLink);
        if (!response.ok) {
          throw new Error('Failed to fetch video from URL');
        }
        
        const videoBlob = await response.blob();
        onVideoSelected(videoBlob, thumbnailBlob);
        
        setIsUploading(false);
      } else {
        throw new Error('Failed to create canvas context');
      }
    } catch (err) {
      setError('Failed to process video URL');
      setIsUploading(false);
      console.error(err);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
      <div className="flex justify-center mb-4">
        <div className="flex space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 rounded-md ${
              activeTab === 'file' ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            <div className="flex items-center">
              <File size={16} className="mr-2" />
              <span>Upload File</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`px-4 py-2 rounded-md ${
              activeTab === 'link' ? 'bg-white shadow-sm' : 'text-gray-600'
            }`}
          >
            <div className="flex items-center">
              <Link size={16} className="mr-2" />
              <span>Add Link</span>
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      {activeTab === 'file' ? (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="video/*"
          />
          <div 
            onClick={triggerFileInput}
            className="border-2 border-dashed border-blue-300 rounded-lg p-8 cursor-pointer hover:bg-blue-50 transition-colors text-center"
          >
            <Upload className="mx-auto text-blue-500 mb-2" size={32} />
            <p className="text-sm text-gray-600 mb-2">
              Click to select a video file
            </p>
            <p className="text-xs text-gray-500">
              Supported formats: MP4, MOV, WebM. Max size: 1GB
            </p>
          </div>
          
          {isUploading && (
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>Processing...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Video URL
            </label>
            <input
              type="text"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              className="border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="https://"
            />
            <p className="text-xs text-gray-500 mt-1">
              YouTube, Vimeo, or direct video URL
            </p>
          </div>
          <button 
            type="submit" 
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            disabled={isUploading}
          >
            <div className="flex items-center justify-center">
              <Check size={16} className="mr-2" />
              <span>Add Video Link</span>
            </div>
          </button>
          
          {isUploading && (
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>Processing link...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </form>
      )}
      
      <div className="mt-4 flex justify-end">
        <button 
          onClick={onCancel} 
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
          disabled={isUploading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default VideoUpload;