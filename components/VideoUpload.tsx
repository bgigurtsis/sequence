// components/VideoUpload.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, File, Check, ArrowLeft } from 'lucide-react';

interface VideoUploadProps {
  onVideoSelected: (videoBlob: Blob, thumbnailBlob: Blob, fileName?: string) => void;
  onCancel: () => void;
  allowLinkInput?: boolean;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ 
  onVideoSelected, 
  onCancel,
  allowLinkInput = true
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'link'>('file');
  const [videoLink, setVideoLink] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // For mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Simple mobile detection
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setSelectedFile(file);
    setIsProcessing(true);
    
    try {
      // Generate thumbnail from video
      const thumbnail = await generateThumbnail(file);
      
      // Pass the file name as the third parameter
      onVideoSelected(file, thumbnail, file.name);
      
      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing video:', error);
      setError('Failed to process video: ' + (error as Error).message);
      setIsProcessing(false);
    }
  };
  
  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoLink) {
      setError('Please enter a video link');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(20);
      
      // Here you would typically handle the link differently,
      // possibly by validating it, fetching metadata, etc.
      // For now, we'll simulate the process
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setUploadProgress(100);
      setIsUploading(false);
      
      // In a real implementation, you would process the link differently
      // Since our current onVideoSelected expects Blobs, we would need to
      // create a different flow for link-based videos
      
      // For now, just log the link
      console.log('Video link submitted:', videoLink);
      
      // This is a placeholder - your actual implementation would differ
      const dummyBlob = new Blob(['link placeholder'], { type: 'text/plain' });
      onVideoSelected(dummyBlob, dummyBlob);
      
    } catch (error) {
      console.error('Error processing video link:', error);
      setError('There was an error processing your video link. Please try again.');
      setIsUploading(false);
    }
  };

  // Generate a thumbnail from a video blob
  const generateThumbnail = (videoBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      video.addEventListener('loadeddata', () => {
        try {
          // Set video to 25% duration to get a good thumbnail frame
          video.currentTime = video.duration * 0.25;
        } catch (e) {
          // If setting currentTime fails, just use the poster frame
          console.warn('Could not set video current time, using poster frame');
        }
      });
      
      video.addEventListener('seeked', () => {
        // Set canvas dimensions to match the video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current frame to the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not generate thumbnail'));
          }
        }, 'image/jpeg', 0.7);
      });
      
      // Handle errors
      video.addEventListener('error', (e) => {
        reject(new Error(`Video error: ${e}`));
      });
      
      // Set the video source and start loading
      video.src = URL.createObjectURL(videoBlob);
      video.load();
    });
  };

  return (
    <div className="bg-white rounded-lg p-4 max-w-lg w-full">
      <div className="flex items-center mb-4">
        <button 
          onClick={onCancel}
          className="mr-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold">Upload Video</h2>
      </div>
      
      {allowLinkInput && (
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 ${activeTab === 'file' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab('file')}
          >
            <div className="flex items-center">
              <File size={16} className="mr-2" />
              <span>Upload File</span>
            </div>
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'link' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
            onClick={() => setActiveTab('link')}
          >
            <div className="flex items-center">
              <LinkIcon size={16} className="mr-2" />
              <span>Video Link</span>
            </div>
          </button>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}
      
      {activeTab === 'file' && (
        <form className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isMobile 
                ? 'Tap to select a video from your device' 
                : 'Drag and drop a video file here, or click to select a file'}
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
          
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{isGeneratingThumbnail ? 'Generating thumbnail...' : 'Processing...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </form>
      )}
      
      {activeTab === 'link' && (
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video URL
            </label>
            <input
              type="url"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              placeholder="Paste your video link (YouTube, Google Drive, etc.)"
              className="w-full p-2 border rounded"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Make sure your video is publicly accessible or shared with the proper permissions
            </p>
          </div>
          
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing link...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-300"
            disabled={isUploading}
          >
            {isUploading ? 'Processing...' : 'Add Video Link'}
          </button>
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