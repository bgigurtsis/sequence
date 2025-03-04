'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Edit, Trash2, Calendar, MapPin, Save } from 'lucide-react';

interface PerformanceData {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  venue: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function PerformanceDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        
        const performanceData = performanceDoc.data() as Omit<PerformanceData, 'id'>;
        
        // Check if this performance belongs to the current user
        if (performanceData.userId !== user.uid) {
          router.push('/');
          return;
        }
        
        const performance = {
          id: performanceDoc.id,
          ...performanceData
        };
        
        setPerformance(performance);
        
        // Initialize form state
        setTitle(performance.title);
        setDescription(performance.description || '');
        setDate(performance.date.toDate().toISOString().split('T')[0]);
        setVenue(performance.venue || '');
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) {
      setError('Title is required');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const performanceRef = doc(db, 'performances', params.id);
      
      await updateDoc(performanceRef, {
        title,
        description,
        date: Timestamp.fromDate(new Date(date)),
        venue,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setPerformance({
        ...performance!,
        title,
        description,
        date: Timestamp.fromDate(new Date(date)),
        venue,
        updatedAt: Timestamp.now()
      });
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating performance:', err);
      setError('Failed to update performance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this performance? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      await deleteDoc(doc(db, 'performances', params.id));
      router.push('/');
    } catch (err) {
      console.error('Error deleting performance:', err);
      setError('Failed to delete performance. Please try again.');
      setIsDeleting(false);
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
          onClick={() => router.push('/')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {isEditing ? (
          <h1 className="text-3xl font-bold">Edit Performance</h1>
        ) : (
          <h1 className="text-3xl font-bold">{performance.title}</h1>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {isEditing ? (
          <form onSubmit={handleUpdate}>
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
                placeholder="Enter performance title"
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
                placeholder="Enter performance description"
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter venue name"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="mr-4 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex justify-between mb-6">
              <div className="flex items-center text-gray-600">
                <Calendar className="h-5 w-5 mr-2" />
                {performance.date.toDate().toLocaleDateString()}
                
                {performance.venue && (
                  <div className="flex items-center ml-6">
                    <MapPin className="h-5 w-5 mr-2" />
                    {performance.venue}
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                  title="Edit performance"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-full disabled:opacity-50"
                  title="Delete performance"
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-red-600"></div>
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            
            {performance.description && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-gray-700 whitespace-pre-line">{performance.description}</p>
              </div>
            )}
            
            <div>
              <h2 className="text-lg font-semibold mb-4">Recordings</h2>
              
              <div className="bg-gray-100 p-8 rounded-lg text-center">
                <p className="text-gray-600 mb-4">No recordings yet</p>
                <button 
                  onClick={() => router.push(`/performances/${params.id}/record`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  Add Recording
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 