'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CloudOff, Cloud, Rewind, FastForward, ChevronRight, ChevronLeft, Copy, FolderPlus } from 'lucide-react';
import { videoStorage } from '../services/videoStorage';
import { Collection } from '../types';
import { usePerformances } from '../contexts/PerformanceContext';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Playback controls
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  // A/B Loop controls
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  
  // Side-by-side comparison
  const [showSideBySide, setShowSideBySide] = useState<boolean>(false);
  const secondVideoRef = useRef<HTMLVideoElement>(null);

  // Collection selector
  const [showCollectionSelector, setShowCollectionSelector] = useState<boolean>(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Get addToCollection from context
  const { collections: contextCollections, addToCollection } = usePerformances();

  // Determine if it's a Drive URL
  const isDriveUrl = videoUrl.includes('drive.google.com');

  // Add to the VideoPlayer component
  const [embedFailed, setEmbedFailed] = useState(false);
  const [externalDomain, setExternalDomain] = useState<string | null>(null);

  useEffect(() => {
    const loadVideo = async () => {
      setIsLoading(true);
      setError(null);
      setEmbedFailed(false);
      
      try {
        // Check if this is an external URL (from link input)
        if (videoUrl.startsWith('http')) {
          console.log('Loading external video URL:', videoUrl);
          
          // Extract domain for display
          try {
            const urlObj = new URL(videoUrl);
            setExternalDomain(urlObj.hostname);
          } catch (e) {
            setExternalDomain('external site');
          }
          
          // For external URLs, we don't need to fetch a blob
          setSource(videoUrl);
          setIsLocalVideo(false);
        } else {
          // Try to get the video from local storage first
          const localVideo = await videoStorage.getVideo(recordingId);
          
          if (localVideo) {
            console.log('Found local video copy, using that');
            const url = URL.createObjectURL(localVideo.videoBlob);
            setSource(url);
            setIsLocalVideo(true);
          } else {
            // If not available locally, use the provided URL
            console.log('No local copy, using provided URL:', videoUrl);
            setSource(videoUrl);
            setIsLocalVideo(false);
          }
        }
      } catch (err) {
        console.error('Error loading video:', err);
        setError('Could not load video: ' + ((err as Error).message || 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVideo();
    
    // Cleanup object URLs on unmount
    return () => {
      if (source && isLocalVideo) {
        URL.revokeObjectURL(source);
      }
    };
  }, [videoUrl, recordingId]);

  // Setup the A/B loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loopEnabled || loopStart === null || loopEnd === null) return;

    const checkTime = () => {
      if (video.currentTime >= loopEnd) {
        video.currentTime = loopStart;
      }
    };

    video.addEventListener('timeupdate', checkTime);
    return () => video.removeEventListener('timeupdate', checkTime);
  }, [loopEnabled, loopStart, loopEnd]);

  // Sync the second video for side-by-side comparison
  useEffect(() => {
    const mainVideo = videoRef.current;
    const secondVideo = secondVideoRef.current;
    if (!mainVideo || !secondVideo || !showSideBySide) return;

    const syncVideos = () => {
      secondVideo.currentTime = mainVideo.currentTime;
      if (mainVideo.paused) {
        secondVideo.pause();
      } else {
        secondVideo.play().catch(e => console.error('Failed to play second video:', e));
      }
      secondVideo.playbackRate = mainVideo.playbackRate;
    };

    mainVideo.addEventListener('play', syncVideos);
    mainVideo.addEventListener('pause', syncVideos);
    mainVideo.addEventListener('seeking', syncVideos);
    mainVideo.addEventListener('ratechange', syncVideos);
    
    // Initial sync
    secondVideo.src = mainVideo.src;
    secondVideo.currentTime = mainVideo.currentTime;
    secondVideo.playbackRate = mainVideo.playbackRate;

    return () => {
      mainVideo.removeEventListener('play', syncVideos);
      mainVideo.removeEventListener('pause', syncVideos);
      mainVideo.removeEventListener('seeking', syncVideos);
      mainVideo.removeEventListener('ratechange', syncVideos);
    };
  }, [showSideBySide]);

  // Handle playback rate change
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Handle play/pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(e => console.error('Failed to play:', e));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Set loop points
  const setLoopPoints = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (!loopEnabled) {
      // When enabling loop, set start to current position and end to +5 seconds
      setLoopStart(video.currentTime);
      setLoopEnd(Math.min(video.currentTime + 5, video.duration));
      setLoopEnabled(true);
    } else {
      // When disabling loop
      setLoopEnabled(false);
      setLoopStart(null);
      setLoopEnd(null);
    }
  };

  // Adjust loop points
  const adjustLoopStart = (delta: number) => {
    if (loopStart === null || !videoRef.current) return;
    const newStart = Math.max(0, loopStart + delta);
    if (loopEnd !== null && newStart < loopEnd) {
      setLoopStart(newStart);
      if (videoRef.current.currentTime < newStart || videoRef.current.currentTime > loopEnd) {
        videoRef.current.currentTime = newStart;
      }
    }
  };

  const adjustLoopEnd = (delta: number) => {
    if (loopEnd === null || !videoRef.current) return;
    const newEnd = Math.min(videoRef.current.duration, loopEnd + delta);
    if (loopStart !== null && newEnd > loopStart) {
      setLoopEnd(newEnd);
    }
  };

  // Frame-by-frame controls
  const frameStep = (forward: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Pause the video first
    video.pause();
    setIsPlaying(false);
    
    // Approximately 1/30th of a second for a typical video frame
    const frameTime = 1/30;
    
    if (forward) {
      video.currentTime = Math.min(video.duration, video.currentTime + frameTime);
    } else {
      video.currentTime = Math.max(0, video.currentTime - frameTime);
    }
  };

  // Toggle side-by-side view
  const toggleSideBySide = () => {
    setShowSideBySide(!showSideBySide);
  };

  // Load collections when component mounts
  useEffect(() => {
    // Collections are now available from context
  }, []);

  // Add a handler for video error events
  const handleVideoError = () => {
    console.error('Video failed to load:', videoUrl);
    setEmbedFailed(true);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
        <div className="bg-white p-4 rounded-lg max-w-3xl w-full">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
        <div className="bg-white p-4 rounded-lg max-w-3xl w-full">
          <div className="text-center py-8">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <p className="text-red-500">{error || "Could not load video"}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded-lg max-w-5xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Video Playback</h2>
          <div className="flex items-center space-x-2">
            {isLocalVideo ? (
              <span className="text-green-500 flex items-center text-sm">
                <Cloud size={16} className="mr-1" /> Local
              </span>
            ) : (
              <span className="text-blue-500 flex items-center text-sm">
                <CloudOff size={16} className="mr-1" /> Cloud
              </span>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className={`relative ${showSideBySide ? 'flex space-x-2' : ''}`}>
          <div className={`${showSideBySide ? 'w-1/2' : 'w-full'}`}>
            <video
              ref={videoRef}
              src={source || undefined}
              className="w-full h-auto rounded-lg"
              controls
              onError={handleVideoError}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {loopEnabled && loopStart !== null && loopEnd !== null && (
              <div className="mt-1 text-xs text-gray-500">
                Loop: {loopStart.toFixed(2)}s - {loopEnd.toFixed(2)}s
              </div>
            )}
            {embedFailed && videoUrl.startsWith('http') && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mt-4">
                <h3 className="font-medium text-yellow-800 mb-2">Video embed failed</h3>
                <p className="text-sm text-yellow-700 mb-3">
                  The video from {externalDomain || 'the external site'} couldn't be embedded directly.
                </p>
                <a 
                  href={videoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Open Video in New Tab
                </a>
              </div>
            )}
          </div>
          
          {showSideBySide && (
            <div className="w-1/2">
              <video
                ref={secondVideoRef}
                className="w-full rounded-lg bg-black"
                playsInline
              />
            </div>
          )}
        </div>

        {/* Advanced controls */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <div className="flex flex-wrap justify-between items-center gap-2">
            {/* Playback speed controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Speed:</span>
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map(rate => (
                <button
                  key={rate}
                  onClick={() => changePlaybackRate(rate)}
                  className={`px-2 py-1 text-sm rounded ${
                    playbackRate === rate 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Frame controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => frameStep(false)}
                className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                title="Previous frame"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={togglePlay}
                className={`px-3 py-1 rounded ${
                  isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => frameStep(true)}
                className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                title="Next frame"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* A/B Loop controls */}
          <div className="mt-3 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={setLoopPoints}
                className={`px-3 py-1 rounded ${
                  loopEnabled ? 'bg-purple-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {loopEnabled ? 'Disable Loop' : 'Enable A/B Loop'}
              </button>
              
              {loopEnabled && (
                <>
                  <button
                    onClick={() => adjustLoopStart(-0.5)}
                    className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                    title="Move start back"
                  >
                    <Rewind size={16} />
                  </button>
                  <button
                    onClick={() => adjustLoopStart(0.5)}
                    className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                    title="Move start forward"
                  >
                    <FastForward size={16} />
                  </button>
                  <span className="text-sm">|</span>
                  <button
                    onClick={() => adjustLoopEnd(-0.5)}
                    className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                    title="Move end back"
                  >
                    <Rewind size={16} />
                  </button>
                  <button
                    onClick={() => adjustLoopEnd(0.5)}
                    className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                    title="Move end forward"
                  >
                    <FastForward size={16} />
                  </button>
                </>
              )}
            </div>
            
            {/* Side-by-side comparison */}
            <div className="flex items-center">
              <button
                onClick={toggleSideBySide}
                className={`px-3 py-1 rounded flex items-center ${
                  showSideBySide ? 'bg-teal-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}
                title="Compare recordings side by side or view a single video"
              >
                <Copy size={16} className="mr-1" />
                {showSideBySide ? 'Single View' : 'Compare Side-by-Side'}
              </button>
              
              {/* Add help tooltip for clarity */}
              <div className="relative ml-2 group">
                <div className="cursor-help text-gray-400 hover:text-gray-600">
                  <span className="rounded-full border border-gray-400 w-5 h-5 inline-flex items-center justify-center text-xs">?</span>
                </div>
                <div className="absolute z-10 w-64 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 transform -translate-x-1/2 mb-1 pointer-events-none">
                  Side-by-side view allows you to compare the current recording with another recording to spot differences in technique or performance.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add to collection */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => {
              // Open collection selector
              setShowCollectionSelector(true);
            }}
            className="flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <FolderPlus size={16} className="mr-1" />
            Add to Collection
          </button>
        </div>
      </div>

      {/* Collection selector */}
      {showCollectionSelector && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col p-4 z-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Add to Collection</h3>
            <button onClick={() => setShowCollectionSelector(false)} className="text-gray-500">
              <X size={20} />
            </button>
          </div>
          
          {collections.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-2">No collections yet</p>
              <button 
                onClick={() => {
                  setShowCollectionSelector(false);
                  // Navigate to collections view or open create collection modal
                }}
                className="text-blue-500 underline"
              >
                Create a collection
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map(collection => (
                <button
                  key={collection.id}
                  onClick={() => {
                    addToCollection(collection.id, recordingId);
                    setShowCollectionSelector(false);
                  }}
                  className="w-full text-left p-2 hover:bg-blue-50 rounded flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{collection.title}</div>
                    {collection.description && (
                      <div className="text-xs text-gray-500">{collection.description}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {collection.recordingIds?.length || 0} items
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;