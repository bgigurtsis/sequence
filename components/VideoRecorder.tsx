import React, { useState, useRef, useEffect } from 'react';
import { useGoogleDrive } from '@/contexts/GoogleDriveContext';
import { Camera, Square, Pause, Play } from 'lucide-react';

interface VideoRecorderProps {
  rehearsalId: string;
  onRecordingComplete: (recording: any) => void;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ rehearsalId, onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    performers: [],
    notes: '',
    tags: [],
    time: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { uploadRecording } = useGoogleDrive();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
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
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsPaused(false);
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

  const generateThumbnail = (videoChunks: Blob[]) => {
    const blob = new Blob(videoChunks, { type: 'video/mp4' });
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
        canvas.toBlob((thumbnailBlob) => {
          if (thumbnailBlob) {
            // Convert the blob to a base64 data URL
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              setThumbnail(dataUrl);
              
              // Save the recording with the generated thumbnail
              const videoBlob = new Blob(videoChunks, { type: 'video/mp4' });
              handleSaveRecording(videoBlob, dataUrl);
            };
            reader.readAsDataURL(thumbnailBlob);
          }
        }, 'image/jpeg', 0.7);
      }
    });
    
    // Trigger the loadedmetadata event
    videoElement.load();
  };
  
  const handleSaveRecording = async (videoBlob: Blob, thumbnailUrl: string) => {
    try {
      // Create recording metadata
      const recordingMetadata = {
        ...metadata,
        thumbnailUrl,
        rehearsalId
      };
      
      // Upload to Google Drive
      const recording = await uploadRecording(rehearsalId, videoBlob, recordingMetadata);
      
      // Call the completion handler with the recording details
      onRecordingComplete(recording);
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  };

  // Handle metadata changes
  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Recording thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      {recordedChunks.length > 0 ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={metadata.title}
              onChange={handleMetadataChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter a title for this recording"
            />
          </div>
        </div>
      ) : (
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <button onClick={startRecording} className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg">
              <Camera className="mr-2" size={20} />
              Start Recording
            </button>
          ) : (
            <>
              {!isPaused ? (
                <button onClick={pauseRecording} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg">
                  <Pause className="mr-2" size={20} />
                  Pause Recording
                </button>
              ) : (
                <button onClick={resumeRecording} className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg">
                  <Play className="mr-2" size={20} />
                  Resume Recording
                </button>
              )}
              <button onClick={stopRecording} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg">
                <Square className="mr-2" size={20} />
                Stop Recording
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;
