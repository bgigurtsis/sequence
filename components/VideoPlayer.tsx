// components/VideoPlayer.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="relative bg-white rounded p-4 max-w-3xl w-full">
        <button onClick={onClose} className="absolute top-2 right-2">
          <X size={24} />
        </button>
        <video controls src={videoUrl} className="w-full h-auto" />
      </div>
    </div>
  );
};

export default VideoPlayer;
