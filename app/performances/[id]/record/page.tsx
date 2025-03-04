'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ArrowLeft, Video, Upload, Save, X } from 'lucide-react';
import { useGoogleDriveUpload } from '@/hooks/useGoogleDriveUpload';

interface PerformanceData {
  id: string;
  title: string;
}

export default function RecordPerformancePage({ params }: { params: { id: string } }) {
  const { user, loading, isGoogleDriveConnected } = useAuth();
  const router = useRouter();
  const { uploadVideoToGoogleDrive, uploadThumbnailToGoogleDrive } = useGoogleDriveUpload();
  
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingMode, setRecordingMode] = useState<'select' | 'record' | 'upload' | 'review'>('select');
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!user) return;
      
      try {
        const performanceDoc = await getDoc(doc(db, 'performances', params.id));
        
        if (!performanceDoc.exists()) {
          router.push('/');
          return;
        }
        
        const performanceData = performanceDoc.data();
        
        // Check if this performance belongs to the current user
        if (performanceData.userId !== user.uid) {
          router.push('/');
          return;
        }
        
        setPerformance({
          id: performanceDoc.id,
          title: performanceData.title
        });
        
        // Set default title
        setTitle(`Recording - ${new Date().toLocaleDateString()}`);
      } catch (error) {
        console.error('Error fetching performance:', error);
        setError('Failed to load performance details.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchPerformance();
    }
  }, [user, params.id, router]);

  // Clean up media stream when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      const mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        
        // Create thumbnail from video
        if (videoRef.current && canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          canvas.getContext('2d')?.drawImage(
            videoRef.current, 
            0, 0, 
            canvas.width, 
            canvas.height
          );
          
          canvas.toBlob((blob) => {
            if (blob) {
              setThumbnailBlob(blob);
              setThumbnailUrl(URL.createObjectURL(blob));
            }
          }, 'image/jpeg', 0.7);
        }
        
        setRecordingMode('review');
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access camera and microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedFile(file);
    
    // Create a thumbnail from the video
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      video.currentTime = 1; // Seek to 1 second
    };
    
    video.oncanplay = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setThumbnailBlob(blob);
          setThumbnailUrl(URL.createObjectURL(blob));
        }
      }, 'image/jpeg', 0.7);
      
      // Clean up
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(file);
    setVideoBlob(file);
    setRecordingMode('review');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveRecording = async () => {
    if (!videoBlob || !thumbnailBlob || !performance) {
      setError('No recording to save');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      let videoUrl = '';
      let thumbnailUrl = '';
      
      if (isGoogleDriveConnected) {
        // Upload to Google Drive
        const videoResponse = await uploadVideoToGoogleDrive(videoBlob, {
          title,
          description,
          performanceId: performance.id
        });
        
        const thumbnailResponse = await uploadThumbnailToGoogleDrive(thumbnailBlob, {
          title: `${title} - thumbnail`,
          performanceId: performance.id
        });
        
        videoUrl = videoResponse.webViewLink;
        thumbnailUrl = thumbnailResponse.webViewLink;
      } else {
        // Upload to Firebase Storage
        const videoStorageRef = ref(storage, `recordings/${user?.uid}/${performance.id}/${Date.now()}.webm`);
        const thumbnailStorageRef = ref(storage, `thumbnails/${user?.uid}/${performance.id}/${Date.now()}.jpg`);
        
        await uploadBytes(videoStorageRef, videoBlob);
        await uploadBytes(thumbnailStorageRef, thumbnailBlob);
        
        videoUrl = await getDownloadURL(videoStorageRef);
        thumbnailUrl = await getDownloadURL(thumbnailStorageRef);
      }
      
      // Add recording to performance document
      const performanceRef = doc(db, 'performances', performance.id);
      
      await updateDoc(performanceRef, {
        recordings: arrayUnion({
          id: Date.now().toString(),
          title,
          description,
          videoUrl,
          thumbnailUrl,
          createdAt: Timestamp.now()
        }),
        updatedAt: Timestamp.now()
      });
      
      // Navigate back to performance page
      router.push(`/performances/${performance.id}`);
    } catch (err) {
      console.error('Error saving recording:', err);
      setError('Failed to save recording. Please try again.');
      setIsUploading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Performance not found or you don't have permission to view it.
        </div>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 flex items-center text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => router.push(`/performances/${params.id}`)}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-3xl font-bold">Record Performance: {performance.title}</h1>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {recordingMode === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => setRecordingMode('record')}
              className="bg-blue-50 p-8 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors"
            >
              <Video className="h-16 w-16 mx-auto mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold mb-2">Record Video</h2>
              <p className="text-gray-600">Use your camera to record a new performance</p>
            </div>
            
            <div 
              onClick={() => setRecordingMode('upload')}
              className="bg-green-50 p-8 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors"
            >
              <Upload className="h-16 w-16 mx-auto mb-4 text-green-600" />
              <h2 className="text-xl font-semibold mb-2">Upload Video</h2>
              <p className="text-gray-600">Upload an existing video file from your device</p>
            </div>
          </div>
        )}
        
        {recordingMode === 'record' && (
          <div>
            <div className="relative">
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline
                className="w-full h-auto rounded-lg bg-black"
              />
              
              {isRecording && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center">
                  <div className="w-3 h-3 rounded-full bg-white mr-2 animate-pulse"></div>
                  {formatTime(recordingTime)}
                </div>
              )}
            </div>
            
            <div className="flex justify-center mt-6">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700"
                >
                  Start Recording
                </button>
              )}
            </div>
            
            <button
              onClick={() => setRecordingMode('select')}
              className="mt-4 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        )}
        
        {recordingMode === 'upload' && (
          <div className="text-center p-8">
            <Upload className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
            
            <label className="block w-full max-w-xs mx-auto">
              <span className="sr-only">Choose video file</span>
              <input 
                type="file" 
                accept="video/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </label>
            
            <button
              onClick={() => setRecordingMode('select')}
              className="mt-6 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        )}
        
        {recordingMode === 'review' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                {videoBlob && (
                  <video 
                    src={URL.createObjectURL(videoBlob)}
                    controls
                    className="w-full h-auto rounded-lg"
                  />
                )}
              </div>
              
              <div>
                <div className="mb-4">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter recording title"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter recording description"
                    rows={4}
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thumbnail
                  </label>
                  {thumbnailUrl && (
                    <div className="relative inline-block">
                      <img 
                        src={thumbnailUrl} 
                        alt="Thumbnail" 
                        className="w-32 h-auto rounded-md border border-gray-300"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={() => setRecordingMode('select')}
                    className="mr-4 flex items-center text-gray-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                  
                  <button
                    onClick={saveRecording}
                    disabled={isUploading || !title}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Recording
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden canvas for thumbnail generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
} 