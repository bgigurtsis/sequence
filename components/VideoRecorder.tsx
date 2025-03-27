import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, Pause, Play, RefreshCw } from 'lucide-react';
import { useAuthStatus } from '@/hooks/useAuthStatus';

// Extend Window interface to include our global functions
declare global {
  interface Window {
    refreshBeforeCriticalOperation?: (enforceGoogleCheck?: boolean) => Promise<boolean>;
    validateAllTokensForRecording?: () => Promise<boolean>;
  }
}

type VideoRecorderProps = {
  onRecordingComplete: (data: { videoBlob: Blob; thumbnail: string }) => void;
};

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isRefreshingSession, setIsRefreshingSession] = useState<boolean>(false);
  const [validationRetries, setValidationRetries] = useState<number>(0);
  const [sessionRefreshed, setSessionRefreshed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const validationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { validateAuth } = useAuthStatus();

  // Run validation check when component mounts to catch problems early
  useEffect(() => {
    // Pre-flight validation check
    const preflightCheck = async () => {
      try {
        if (typeof window !== 'undefined' && window.validateAllTokensForRecording) {
          const isValid = await window.validateAllTokensForRecording();
          if (!isValid) {
            console.warn('Pre-flight token validation failed. Session may need refresh.');
          }
        }
      } catch (error) {
        console.error('Error during pre-flight validation check:', error);
      }
    };
    
    preflightCheck();
    
    // Clean up any timers on unmount
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, []);

  const validateAuthentication = async (): Promise<boolean> => {
    setSessionError(null);
    
    try {
      const isValid = await validateAuth(true); // Pass true to check Google as well
      
      if (!isValid) {
        setSessionError('Authentication required. Please sign in.');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating authentication:', error);
      setSessionError('Authentication error. Please try again.');
      return false;
    }
  };

  const runInitialValidation = async () => {
    setSessionError(null);
    setIsRefreshingSession(true);
    
    try {
      const success = await validateAuthentication();
      if (!success) {
        console.warn('Initial authentication validation failed');
      }
    } catch (error) {
      console.error('Error during initial validation:', error);
    } finally {
      setIsRefreshingSession(false);
    }
  };

  const refreshSession = async () => {
    setIsRefreshingSession(true);
    setSessionError(null);
    
    try {
      const success = await validateAuthentication();
      if (success) {
        setTimeout(() => setSessionRefreshed(false), 3000); // Reset after 3 seconds
      } else {
        setSessionError('Failed to refresh your session. Please try again, or refresh the page if the problem persists.');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      setSessionError('An error occurred while refreshing your session.');
    } finally {
      setIsRefreshingSession(false);
    }
  };

  const startRecording = async () => {
    try {
      // Clear any previous errors
      setSessionError(null);
      
      // Validate tokens before starting recording
      const tokensValid = await validateAuthentication();
      if (!tokensValid) {
        setSessionError('Failed to validate your session. Click "Refresh Session" and try again, or refresh the page if the problem persists.');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        setRecordedChunks(chunks);
        generateThumbnail(chunks);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setIsRefreshingSession(false);
      setSessionError(`Could not access camera: ${(err as Error).message}`);
    }
  };

  const stopRecording = async () => {
    try {
      setSessionError(null);
      setIsRefreshingSession(true);
      
      // Try to validate all tokens before stopping to ensure we have valid session for upload
      let tokensValid = await validateAuthentication();
      
      setIsRefreshingSession(false);
      
      // Now stop the recording regardless of token validation
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      // If tokens were invalid, set a warning but still allow the recording to complete
      if (!tokensValid) {
        setSessionError('Session validation issues detected. The recording was saved, but you may need to refresh the session to upload it.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRefreshingSession(false);
      
      // Still try to stop recording even if session refresh fails
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      setSessionError('Error during session validation. The recording was saved, but you may need to refresh the page to upload it.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const generateThumbnail = async (videoChunks: Blob[]) => {
    try {
      const blob = new Blob(videoChunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.muted = true;
      videoElement.playsInline = true;

      videoElement.addEventListener('loadedmetadata', () => {
        // If the video is shorter than 1 second, use half its duration.
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
          
          // When generating thumbnail, validate session one more time before completing
          canvas.toBlob(async (thumbnailBlob) => {
            if (thumbnailBlob) {
              // Validate session again before sending to parent component
              setIsRefreshingSession(true);
              let tokensValid = false;
              
              // Make multiple attempts to validate tokens
              tokensValid = await validateAuthentication();
              setIsRefreshingSession(false);
              
              // Convert the blob to a base64 data URL so it persists across reloads
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setThumbnail(dataUrl);
                
                // Warn if tokens validation failed but still proceed with the recording
                if (!tokensValid) {
                  setSessionError('Your session may have expired. The recording is ready, but you may need to refresh the session before uploading it.');
                }
                
                // Complete the recording regardless of session state
                onRecordingComplete({ videoBlob: blob, thumbnail: dataUrl });
              };
              reader.readAsDataURL(thumbnailBlob);
            }
          }, 'image/jpeg', 0.7);
        }
      });
      
      // Ensure video can load
      videoElement.load();

    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setSessionError('Error creating video thumbnail. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {sessionError && (
        <div className="bg-red-50 text-red-700 p-2 rounded-md flex flex-col items-center w-full">
          <p>{sessionError}</p>
          <button 
            onClick={refreshSession}
            className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md flex items-center text-sm"
            disabled={isRefreshingSession}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh Session
          </button>
        </div>
      )}
      
      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        
        {isRefreshingSession && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <RefreshCw className="w-8 h-8 text-white animate-spin" />
              <p className="text-white">Validating session...</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex space-x-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isRefreshingSession}
            className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Start recording"
          >
            <Camera className="w-6 h-6" />
          </button>
        ) : (
          <>
            <button
              onClick={stopRecording}
              disabled={isRefreshingSession}
              className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Stop recording"
            >
              <Square className="w-6 h-6" />
            </button>
            
            {isPaused ? (
              <button
                onClick={resumeRecording}
                disabled={isRefreshingSession}
                className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                aria-label="Resume recording"
              >
                <Play className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                disabled={isRefreshingSession}
                className="bg-yellow-600 text-white p-3 rounded-full hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                aria-label="Pause recording"
              >
                <Pause className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
