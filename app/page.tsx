// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { RedirectToSignIn, UserButton, useUser } from '@clerk/nextjs';
import { Camera, Upload, Plus } from 'lucide-react';
import { PerformanceProvider, usePerformances } from '../contexts/PerformanceContext';
import VideoRecorder from '../components/VideoRecorder';
import MetadataForm from '../components/MetadataForm';
import VideoPlayer from '../components/VideoPlayer';
import RehearsalTimeline from '../components/RehearsalTimeline';
import PerformanceForm from '../components/PerformanceForm';
import RehearsalForm from '../components/RehearsalForm';
import VideoUpload from '../components/VideoUpload';
import TodaysRecordings from '../components/TodaysRecordings';
import { PendingVideo, Recording, Rehearsal, Performance, Metadata } from '../types';

import SyncStatus from '../components/SyncStatus';
import CalendarView from '../components/CalendarView';
import SearchBar from '../components/SearchBar';
import CollectionsView from '../components/CollectionsView';
import PerformanceSelector from '../components/PerformanceSelector';
import { generateId } from '../lib/utils';
import RecordingOptions from '../components/RecordingOptions';
import VideoLinkInput from '../components/VideoLinkInput';
import RecordingDetailsModal from '../components/RecordingDetailsModal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlusCircle, Video, Music, Calendar } from 'lucide-react';

interface PerformanceData {
  id: string;
  title: string;
  date: string;
  description: string;
  recordingUrl?: string;
  thumbnailUrl?: string;
}

// Add a utility function to format dates consistently
function formatDateForMetadata(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');
}

// Main Page Component (Wrapper with PerformanceProvider)
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [performances, setPerformances] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPerformances = async () => {
      if (!user) return;
      
      try {
        const performancesQuery = query(
          collection(db, 'performances'),
          where('userId', '==', user.uid),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(performancesQuery);
        const performancesList: PerformanceData[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          performancesList.push({
            id: doc.id,
            title: data.title,
            date: data.date.toDate().toLocaleDateString(),
            description: data.description,
            recordingUrl: data.recordingUrl,
            thumbnailUrl: data.thumbnailUrl
          });
        });
        
        setPerformances(performancesList);
      } catch (error) {
        console.error('Error fetching performances:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchPerformances();
    }
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Performances</h1>
        <button 
          onClick={() => router.push('/performances/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          New Performance
        </button>
      </div>

      {performances.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">No performances yet</h2>
          <p className="text-gray-600 mb-6">
            Create your first performance to start recording and organizing your work.
          </p>
          <button 
            onClick={() => router.push('/performances/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md inline-flex items-center"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Performance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {performances.map((performance) => (
            <div 
              key={performance.id}
              onClick={() => router.push(`/performances/${performance.id}`)}
              className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="h-48 bg-gray-200 relative">
                {performance.thumbnailUrl ? (
                  <img 
                    src={performance.thumbnailUrl} 
                    alt={performance.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Music className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                {performance.recordingUrl && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full">
                    <Video className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{performance.title}</h3>
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Calendar className="h-4 w-4 mr-1" />
                  {performance.date}
                </div>
                <p className="text-gray-700 text-sm line-clamp-2">{performance.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
