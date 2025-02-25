'use client';

import React, { useState } from 'react';
import { Camera, Upload, Link as LinkIcon } from 'lucide-react';

interface RecordingOptionsProps {
  onRecord: () => void;
  onUpload: () => void;
  onLinkVideo: () => void;
}

const RecordingOptions: React.FC<RecordingOptionsProps> = ({
  onRecord,
  onUpload,
  onLinkVideo
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Add New Recording</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Record Live Option */}
        <button
          onClick={onRecord}
          className="flex flex-col items-center justify-center p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <div className="bg-blue-100 p-3 rounded-full mb-3">
            <Camera className="h-6 w-6 text-blue-600" />
          </div>
          <span className="font-medium text-sm">Record Live</span>
          <p className="text-xs text-gray-500 text-center mt-1">
            Use your device camera to record a new video
          </p>
        </button>
        
        {/* Upload File Option */}
        <button
          onClick={onUpload}
          className="flex flex-col items-center justify-center p-4 border-2 border-purple-500 rounded-lg hover:bg-purple-50 transition-colors"
        >
          <div className="bg-purple-100 p-3 rounded-full mb-3">
            <Upload className="h-6 w-6 text-purple-600" />
          </div>
          <span className="font-medium text-sm">Upload Video</span>
          <p className="text-xs text-gray-500 text-center mt-1">
            Upload a video file from your device
          </p>
        </button>
        
        {/* Add Link Option */}
        <button
          onClick={onLinkVideo}
          className="flex flex-col items-center justify-center p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors"
        >
          <div className="bg-green-100 p-3 rounded-full mb-3">
            <LinkIcon className="h-6 w-6 text-green-600" />
          </div>
          <span className="font-medium text-sm">Add Video Link</span>
          <p className="text-xs text-gray-500 text-center mt-1">
            Link to a video from Google Drive, YouTube, etc.
          </p>
        </button>
      </div>
    </div>
  );
};

export default RecordingOptions; 