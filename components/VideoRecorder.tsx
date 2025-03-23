import React, { useState, useRef, useEffect } from 'react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { Camera, Square, Pause, Play } from 'lucide-react';

interface VideoRecorderProps {
  rehearsalId: string;
  metadata?: {
    title?: string;
    performers?: string[];
    notes?: string;
    tags?: string[];
  };
  onRecordingComplete: (recording: any) => void;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  rehearsalId,
  metadata = {},
  onRecordingComplete,
}) => {
  const { uploadRecording } = useGoogleDrive();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera access
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
    }
  };

  // Initialize camera on component mount
  useEffect(() => {
    startCamera();

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start recording
  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start(1000); // Collect data every second
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setIsPaused(false);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    setIsProcessing(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          const recordingBlob = new Blob(chunksRef.current, { type: 'video/webm' });

          // Generate thumbnail from video
          const thumbnailUrl = await generateThumbnail(recordingBlob);

          // Save the recording to Google Drive
          await handleSaveRecording(recordingBlob, thumbnailUrl);

          resolve();
        } catch (error) {
          console.error('Error processing recording:', error);
          setError('Failed to process recording. Please try again.');
          resolve();
        }
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    });
  };

  // Generate a thumbnail from the recorded video
  const generateThumbnail = async (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.src = URL.createObjectURL(videoBlob);

      video.onloadeddata = () => {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Seek to 1 second into the video (or wherever you want the thumbnail from)
        video.currentTime = 1;
      };

      video.onseeked = () => {
        // Draw the video frame on canvas
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        // Convert canvas to data URL
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

        // Clean up
        URL.revokeObjectURL(video.src);

        resolve(thumbnailUrl);
      };
    });
  };

  // Save recording to Google Drive
  const handleSaveRecording = async (videoBlob: Blob, thumbnailUrl: string) => {
    try {
      // Create recording metadata
      const recordingMetadata = {
        title: metadata.title || 'Untitled Recording',
        time: new Date().toLocaleTimeString(),
        performers: metadata.performers || [],
        notes: metadata.notes || '',
        tags: metadata.tags || [],
        rehearsalId,
        date: new Date().toLocaleDateString(),
        thumbnailUrl,
      };

      // Upload directly to Google Drive
      if (uploadRecording) {
        const recording = await uploadRecording(
          rehearsalId,
          videoBlob,
          recordingMetadata
        );

        // Call the completion handler
        onRecordingComplete(recording);
        setIsProcessing(false);
        setRecordingTime(0);
      } else {
        console.error('uploadRecording is undefined');
        setError('Failed to save recording. Please try again.');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error saving recording:', error);
      setError('Failed to save recording. Please try again.');
      setIsProcessing(false);
    }
  };

  // Format recording time (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto"
          autoPlay
          muted
          playsInline
        />

        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center bg-black bg-opacity-50 px-3 py-1 rounded-full">
            <div className="w-3 h-3 rounded-full bg-red-600 mr-2 animate-pulse"></div>
            <span className="text-white text-sm font-medium">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-opacity-25 border-t-white"></div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex items-center justify-center bg-red-600 text-white p-4 rounded-full disabled:opacity-50"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="6"></circle>
            </svg>
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="flex items-center justify-center bg-green-600 text-white p-4 rounded-full"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="flex items-center justify-center bg-yellow-500 text-white p-4 rounded-full"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
            )}

            <button
              onClick={stopRecording}
              className="flex items-center justify-center bg-gray-700 text-white p-4 rounded-full"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
