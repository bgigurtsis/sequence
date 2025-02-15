import React, { useState, useRef } from 'react';
import { Camera, Square } from 'lucide-react';

type VideoRecorderProps = {
  onRecordingComplete: (data: { videoBlob: Blob; thumbnail: string }) => void;
};

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play(); // Ensure live preview starts
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
    } catch (err) {
      console.error('Error accessing camera:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  };

  const generateThumbnail = (videoChunks: Blob[]) => {
    const blob = new Blob(videoChunks, { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(blob);
    const videoElement = document.createElement('video');
    
    videoElement.src = videoUrl;
    videoElement.currentTime = 1; // Capture frame at 1 second
    
    videoElement.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
        canvas.toBlob((thumbnailBlob) => {
          if (thumbnailBlob) {
            const thumbnailURL = URL.createObjectURL(thumbnailBlob);
            setThumbnail(thumbnailURL);
            onRecordingComplete({ videoBlob: blob, thumbnail: thumbnailURL });
          }
        }, 'image/jpeg', 0.7);
      }
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline
          className="w-full h-full object-cover"
        />
        {thumbnail && (
          <img 
            src={thumbnail} 
            alt="Recording thumbnail" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex justify-center space-x-4">
        {!isRecording && recordedChunks.length === 0 && (
          <button
            onClick={startRecording}
            className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            <Camera className="mr-2" size={20} />
            Start Recording
          </button>
        )}
        
        {isRecording && (
          <button
            onClick={stopRecording}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg"
          >
            <Square className="mr-2" size={20} />
            Stop Recording
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoRecorder;
