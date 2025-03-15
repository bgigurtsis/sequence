'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  where, 
  getDocs, 
  getDoc, 
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { useGoogleDriveUpload } from '@/hooks/useGoogleDriveUpload';

export type Performance = {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  description?: string;
  performers?: string[];
  tags?: string[];
  createdAt: Timestamp;
  userId: string;
  updatedAt: Timestamp;
  googleDriveFolderId?: string;
  googleDriveFolderLink?: string;
};

export type Rehearsal = {
  id: string;
  performanceId: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  notes?: string;
  createdAt: Timestamp;
  userId: string;
  updatedAt: Timestamp;
  googleDriveFolderId?: string;
  googleDriveFolderLink?: string;
};

export type Recording = {
  id: string;
  title: string;
  performanceId?: string;
  rehearsalId?: string;
  googleFileId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  notes?: string;
  performers?: string[];
  tags?: string[];
  sourceType: 'recorded' | 'uploaded';
  createdAt: Timestamp;
  userId: string;
  updatedAt: Timestamp;
  googleDriveVideoId?: string;
  googleDriveVideoLink?: string;
  googleDriveThumbnailId?: string;
  googleDriveThumbnailLink?: string;
};

export type PerformanceContextType = {
  performances: Performance[];
  rehearsals: { [performanceId: string]: Rehearsal[] };
  recordings: { [entityId: string]: Recording[] };
  selectedPerformance: Performance | null;
  selectedRehearsal: Rehearsal | null;
  loading: boolean;
  error: string | null;
  createPerformance: (performance: Omit<Performance, 'id' | 'createdAt' | 'userId' | 'updatedAt' | 'googleDriveFolderId' | 'googleDriveFolderLink'>) => Promise<string>;
  updatePerformance: (id: string, data: Partial<Performance>) => Promise<void>;
  deletePerformance: (id: string) => Promise<void>;
  createRehearsal: (rehearsal: Omit<Rehearsal, 'id' | 'createdAt' | 'userId' | 'updatedAt' | 'googleDriveFolderId' | 'googleDriveFolderLink'>) => Promise<string>;
  updateRehearsal: (id: string, data: Partial<Rehearsal>) => Promise<void>;
  deleteRehearsal: (id: string) => Promise<void>;
  selectPerformance: (performance: Performance | null) => void;
  selectRehearsal: (rehearsal: Rehearsal | null) => void;
  getPerformance: (id: string) => Promise<Performance | null>;
  getRehearsal: (id: string) => Promise<Rehearsal | null>;
  getRecordingsForEntity: (entityType: 'performance' | 'rehearsal', entityId: string) => Promise<Recording[]>;
  addRecording: (recording: Omit<Recording, 'id' | 'createdAt' | 'userId'>) => Promise<string>;
  deleteRecording: (id: string) => Promise<void>;
  isPerformanceModalOpen: boolean;
  isRehearsalModalOpen: boolean;
  openPerformanceModal: () => void;
  closePerformanceModal: () => void;
  openRehearsalModal: () => void;
  closeRehearsalModal: () => void;
};

export const PerformanceContext = createContext<PerformanceContextType | null>(null);

export const PerformanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [rehearsals, setRehearsals] = useState<{ [performanceId: string]: Rehearsal[] }>({});
  const [recordings, setRecordings] = useState<{ [entityId: string]: Recording[] }>({});
  const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null);
  const [selectedRehearsal, setSelectedRehearsal] = useState<Rehearsal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState<boolean>(false);
  const [isRehearsalModalOpen, setIsRehearsalModalOpen] = useState<boolean>(false);
  const { 
    createPerformanceFolder, 
    createRehearsalFolder 
  } = useGoogleDriveUpload();

  // Load performances for the current user
  useEffect(() => {
    if (!user) {
      setPerformances([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'performances'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const performancesData: Performance[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Performance, 'id'>),
        }));

        setPerformances(performancesData);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching performances:', error);
        setError('Failed to load performances');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up performance listener:', err);
      setError('Failed to load performances');
      setLoading(false);
    }
  }, [user]);

  // Load rehearsals for performances
  useEffect(() => {
    if (!user || performances.length === 0) {
      setRehearsals({});
      return;
    }

    const rehearsalsData: { [performanceId: string]: Rehearsal[] } = {};
    const unsubscribes: (() => void)[] = [];

    performances.forEach((performance) => {
      try {
        const q = query(
          collection(db, 'rehearsals'),
          where('performanceId', '==', performance.id),
          where('userId', '==', user.uid),
          orderBy('date', 'asc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const rehearsalsList: Rehearsal[] = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Rehearsal, 'id'>),
          }));

          rehearsalsData[performance.id] = rehearsalsList;
          setRehearsals({ ...rehearsalsData });
        }, (error) => {
          console.error(`Error fetching rehearsals for performance ${performance.id}:`, error);
        });

        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`Error setting up rehearsal listener for performance ${performance.id}:`, err);
      }
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, performances]);

  // Create a new performance
  const createPerformance = async (performanceData: Omit<Performance, 'id' | 'createdAt' | 'userId' | 'updatedAt' | 'googleDriveFolderId' | 'googleDriveFolderLink'>): Promise<string> => {
    if (!user) throw new Error('User must be authenticated to create a performance');

    try {
      const docRef = await addDoc(collection(db, 'performances'), {
        ...performanceData,
        userId: user.uid,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Create folder in Google Drive
      try {
        const folder = await createPerformanceFolder(
          performanceData.title,
          docRef.id
        );
        
        // Update performance with Google Drive folder info
        await updateDoc(doc(db, 'performances', docRef.id), {
          googleDriveFolderId: folder.id,
          googleDriveFolderLink: folder.webViewLink
        });
        
        // Add Google Drive info to the local state
        const updatedPerformanceData = {
          ...performanceData,
          id: docRef.id,
          googleDriveFolderId: folder.id,
          googleDriveFolderLink: folder.webViewLink
        };
        
        setPerformances(prevPerformances => [
          ...prevPerformances,
          updatedPerformanceData as Performance
        ]);
      } catch (error) {
        console.error('Error creating Google Drive folder:', error);
        // Still add performance to state even if Drive folder creation fails
        const updatedPerformanceData = {
          ...performanceData,
          id: docRef.id,
          googleDriveFolderId: undefined,
          googleDriveFolderLink: undefined
        };
        
        setPerformances(prevPerformances => [
          ...prevPerformances,
          updatedPerformanceData as Performance
        ]);
      }
      
      return docRef.id;
    } catch (err) {
      console.error('Error creating performance:', err);
      setError('Failed to create performance');
      throw err;
    }
  };

  // Update a performance
  const updatePerformance = async (id: string, data: Partial<Performance>): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to update a performance');

    try {
      const performanceRef = doc(db, 'performances', id);
      await updateDoc(performanceRef, data);
    } catch (err) {
      console.error(`Error updating performance ${id}:`, err);
      setError('Failed to update performance');
      throw err;
    }
  };

  // Delete a performance
  const deletePerformance = async (id: string): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to delete a performance');

    try {
      // First, delete all rehearsals associated with this performance
      if (rehearsals[id]) {
        for (const rehearsal of rehearsals[id]) {
          await deleteRehearsal(rehearsal.id);
        }
      }

      // Then delete the performance itself
      await deleteDoc(doc(db, 'performances', id));
    } catch (err) {
      console.error(`Error deleting performance ${id}:`, err);
      setError('Failed to delete performance');
      throw err;
    }
  };

  // Create a new rehearsal
  const createRehearsal = async (rehearsalData: Omit<Rehearsal, 'id' | 'createdAt' | 'userId' | 'updatedAt' | 'googleDriveFolderId' | 'googleDriveFolderLink'>): Promise<string> => {
    if (!user) throw new Error('User must be authenticated to create a rehearsal');

    try {
      // Get the performance to get the Google Drive folder ID
      const performanceDoc = await getDoc(doc(db, 'performances', rehearsalData.performanceId));
      
      if (!performanceDoc.exists()) {
        throw new Error('Performance not found');
      }
      
      const performance = performanceDoc.data() as Performance;
      
      // Check if user owns this performance
      if (performance.userId !== user.uid) {
        throw new Error('Not authorized to add rehearsals to this performance');
      }
      
      const docRef = await addDoc(
        collection(db, 'performances', rehearsalData.performanceId, 'rehearsals'), 
        {
          ...rehearsalData,
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date())
        }
      );
      
      // Create folder in Google Drive if we have a parent folder ID
      if (performance.googleDriveFolderId) {
        try {
          const folder = await createRehearsalFolder(
            rehearsalData.title,
            performance.googleDriveFolderId,
            docRef.id,
            rehearsalData.performanceId
          );
          
          // Update rehearsal with Google Drive folder info
          await updateDoc(doc(db, 'performances', rehearsalData.performanceId, 'rehearsals', docRef.id), {
            googleDriveFolderId: folder.id,
            googleDriveFolderLink: folder.webViewLink
          });
          
          // Add Google Drive info to the local state
          const updatedRehearsalData = {
            ...rehearsalData,
            id: docRef.id,
            googleDriveFolderId: folder.id,
            googleDriveFolderLink: folder.webViewLink
          };
          
          setRehearsals(prevRehearsals => ({
            ...prevRehearsals,
            [rehearsalData.performanceId]: [
              ...prevRehearsals[rehearsalData.performanceId],
              updatedRehearsalData as Rehearsal
            ]
          }));
        } catch (error) {
          console.error('Error creating Google Drive folder:', error);
          // Still add rehearsal to state even if Drive folder creation fails
          const updatedRehearsalData = {
            ...rehearsalData,
            id: docRef.id,
            googleDriveFolderId: undefined,
            googleDriveFolderLink: undefined
          };
          
          setRehearsals(prevRehearsals => ({
            ...prevRehearsals,
            [rehearsalData.performanceId]: [
              ...prevRehearsals[rehearsalData.performanceId],
              updatedRehearsalData as Rehearsal
            ]
          }));
        }
      } else {
        // No Google Drive folder, just add to state
        const updatedRehearsalData = {
          ...rehearsalData,
          id: docRef.id
        };
        
        setRehearsals(prevRehearsals => ({
          ...prevRehearsals,
          [rehearsalData.performanceId]: [
            ...prevRehearsals[rehearsalData.performanceId],
            updatedRehearsalData as Rehearsal
          ]
        }));
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating rehearsal:', error);
      setError('Failed to create rehearsal');
      throw error;
    }
  };

  // Update a rehearsal
  const updateRehearsal = async (id: string, data: Partial<Rehearsal>): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to update a rehearsal');

    try {
      const rehearsalRef = doc(db, 'rehearsals', id);
      await updateDoc(rehearsalRef, data);
    } catch (err) {
      console.error(`Error updating rehearsal ${id}:`, err);
      setError('Failed to update rehearsal');
      throw err;
    }
  };

  // Delete a rehearsal
  const deleteRehearsal = async (id: string): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to delete a rehearsal');

    try {
      // Delete all recordings associated with this rehearsal
      const recordingsQuery = query(
        collection(db, 'recordings'),
        where('rehearsalId', '==', id)
      );
      
      const recordingSnapshot = await getDocs(recordingsQuery);
      for (const recordingDoc of recordingSnapshot.docs) {
        await deleteRecording(recordingDoc.id);
      }

      // Then delete the rehearsal itself
      await deleteDoc(doc(db, 'rehearsals', id));
    } catch (err) {
      console.error(`Error deleting rehearsal ${id}:`, err);
      setError('Failed to delete rehearsal');
      throw err;
    }
  };

  // Get a specific performance by ID
  const getPerformance = async (id: string): Promise<Performance | null> => {
    try {
      const performanceRef = doc(db, 'performances', id);
      const performanceSnap = await getDoc(performanceRef);
      
      if (performanceSnap.exists()) {
        return { 
          id: performanceSnap.id, 
          ...(performanceSnap.data() as Omit<Performance, 'id'>) 
        };
      }
      
      return null;
    } catch (err) {
      console.error(`Error fetching performance ${id}:`, err);
      setError('Failed to fetch performance');
      throw err;
    }
  };

  // Get a specific rehearsal by ID
  const getRehearsal = async (id: string): Promise<Rehearsal | null> => {
    try {
      const rehearsalRef = doc(db, 'rehearsals', id);
      const rehearsalSnap = await getDoc(rehearsalRef);
      
      if (rehearsalSnap.exists()) {
        return { 
          id: rehearsalSnap.id, 
          ...(rehearsalSnap.data() as Omit<Rehearsal, 'id'>) 
        };
      }
      
      return null;
    } catch (err) {
      console.error(`Error fetching rehearsal ${id}:`, err);
      setError('Failed to fetch rehearsal');
      throw err;
    }
  };

  // Get all recordings for a specific entity (performance or rehearsal)
  const getRecordingsForEntity = async (
    entityType: 'performance' | 'rehearsal', 
    entityId: string
  ): Promise<Recording[]> => {
    try {
      const fieldName = entityType === 'performance' ? 'performanceId' : 'rehearsalId';
      const recordingsQuery = query(
        collection(db, 'recordings'),
        where(fieldName, '==', entityId),
        orderBy('createdAt', 'desc')
      );
      
      const recordingsSnapshot = await getDocs(recordingsQuery);
      const recordingsData: Recording[] = recordingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Recording, 'id'>),
      }));
      
      return recordingsData;
    } catch (err) {
      console.error(`Error fetching recordings for ${entityType} ${entityId}:`, err);
      setError(`Failed to fetch recordings for ${entityType}`);
      throw err;
    }
  };

  // Add a new recording
  const addRecording = async (recordingData: Omit<Recording, 'id' | 'createdAt' | 'userId'>): Promise<string> => {
    if (!user) throw new Error('User must be authenticated to add a recording');

    try {
      const docRef = await addDoc(collection(db, 'recordings'), {
        ...recordingData,
        userId: user.uid,
        createdAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding recording:', err);
      setError('Failed to add recording');
      throw err;
    }
  };

  // Delete a recording
  const deleteRecording = async (id: string): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to delete a recording');

    try {
      await deleteDoc(doc(db, 'recordings', id));
    } catch (err) {
      console.error(`Error deleting recording ${id}:`, err);
      setError('Failed to delete recording');
      throw err;
    }
  };

  // Modal control functions
  const openPerformanceModal = () => setIsPerformanceModalOpen(true);
  const closePerformanceModal = () => setIsPerformanceModalOpen(false);
  const openRehearsalModal = () => setIsRehearsalModalOpen(true);
  const closeRehearsalModal = () => setIsRehearsalModalOpen(false);

  // Context value
  const value: PerformanceContextType = {
        performances,
    rehearsals,
    recordings,
        selectedPerformance,
    selectedRehearsal,
    loading,
    error,
    createPerformance,
        updatePerformance,
        deletePerformance,
    createRehearsal,
        updateRehearsal,
        deleteRehearsal,
    selectPerformance: setSelectedPerformance,
    selectRehearsal: setSelectedRehearsal,
    getPerformance,
    getRehearsal,
    getRecordingsForEntity,
        addRecording,
        deleteRecording,
    isPerformanceModalOpen,
    isRehearsalModalOpen,
    openPerformanceModal,
    closePerformanceModal,
    openRehearsalModal,
    closeRehearsalModal,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

// Custom hook to use the PerformanceContext
export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

export default PerformanceProvider; 