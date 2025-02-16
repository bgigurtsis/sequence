// components/VideoPlayer.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, onClose }) => {
  // If the URL includes "drive.google.com", we assume it's a Drive preview URL.
  const isDriveUrl = videoUrl.includes('drive.google.com');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="relative bg-white rounded p-4 max-w-3xl w-full">
        <button onClick={onClose} className="absolute top-2 right-2">
          <X size={24} />
        </button>
        {isDriveUrl ? (
          // Use an iframe for Google Drive previews.
          <iframe
            src={videoUrl}
            width="100%"
            height="500px"
            allow="autoplay"
            frameBorder="0"
          />
        ) : (
          // Otherwise, use a standard video tag.
          <video controls src={videoUrl} className="w-full h-auto" />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
