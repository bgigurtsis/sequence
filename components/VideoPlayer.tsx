// components/VideoPlayer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, CloudOff, Cloud } from 'lucide-react';
import { videoStorage } from '../services/videoStorage';

interface VideoPlayerProps {
  videoUrl: string;
  recordingId: string;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, recordingId, onClose }) => {
  const [source, setSource] = useState<string | null>(null);
  const [isLocalVideo, setIsLocalVideo] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine if it's a Drive URL
  const isDriveUrl = videoUrl.includes('drive.google.com');

  useEffect(() => {
    async function loadVideo() {
      try {
        setIsLoading(true);
        
        // Try to get from local storage first
        const localVideo = await videoStorage.getVideo(recordingId);
        
        if (localVideo) {
          // Create a blob URL for the local video
          const blobUrl = URL.createObjectURL(localVideo.videoBlob);
          setSource(blobUrl);
          setIsLocalVideo(true);
          console.log('Using local video copy');
        } else {
          // Fall back to the cloud URL
          setSource(videoUrl);
          setIsLocalVideo(false);
          console.log('Using cloud video');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading video:', err);
        setError('Failed to load video. Please try again.');
        setIsLoading(false);
        
        // Fall back to the cloud URL if there's an error with local storage
        setSource(videoUrl);
        setIsLocalVideo(false);
      }
    }
    
    loadVideo();
    
    // Clean up blob URL on unmount
    return () => {
      if (source && isLocalVideo) {
        URL.revokeObjectURL(source);
      }
    };
  }, [videoUrl, recordingId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="relative bg-white rounded-lg max-w-3xl w-full mx-4">
        <div className="flex justify-between items-center p-3 border-b">
          <div className="flex items-center">
            {isLocalVideo ? (
              <div className="flex items-center text-green-600 text-sm">
                <CloudOff size={16} className="mr-1" />
                <span>Playing from device storage</span>
              </div>
            ) : (
              <div className="flex items-center text-blue-600 text-sm">
                <Cloud size={16} className="mr-1" />
                <span>Playing from cloud</span>
              </div>
            )}
          </div>
          
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-gray-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="relative aspect-video bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white text-center p-4">
              <div>
                <p className="mb-2">{error}</p>
                <button 
                  onClick={() => window.open(videoUrl, '_blank')}
                  className="px-4 py-2 bg-blue-500 rounded-lg text-sm"
                >
                  Try opening in browser
                </button>
              </div>
            </div>
          )}

          {isDriveUrl && !isLocalVideo ? (
            // Use an iframe for Google Drive videos when playing from cloud
            <iframe
              src={source || ''}
              width="100%"
              height="100%"
              allow="autoplay"
              frameBorder="0"
              className={isLoading ? 'opacity-0' : 'opacity-100'}
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            // Use a video tag for local videos and other sources
            <video 
              controls 
              src={source || ''} 
              className={`w-full h-full ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoadedData={() => setIsLoading(false)}
              onError={(e) => {
                console.error('Video error:', e);
                setError('Failed to load video');
                setIsLoading(false);
              }}
              autoPlay
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;