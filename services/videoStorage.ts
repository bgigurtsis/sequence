// services/videoStorage.ts
import { VideoStorageItem } from '../types';

// Simple interface for IndexedDB operations
interface IDBOperations {
  saveVideo: (
    id: string, 
    videoBlob: Blob, 
    thumbnailBlob: Blob, 
    metadata: {
      title: string;
      performanceId: string;
      rehearsalId: string;
      createdAt: string;
      performers: string[];
      tags: string[];
    }
  ) => Promise<boolean>;
  
  getVideo: (id: string) => Promise<VideoStorageItem | null>;
  deleteVideo: (id: string) => Promise<boolean>;
  listVideos: () => Promise<VideoStorageItem[]>;
  clearOldVideos: (maxAgeInDays?: number) => Promise<number>;
}

// IndexedDB implementation
const createVideoStorage = (): IDBOperations => {
  const DB_NAME = 'stagevault-videos';
  const STORE_NAME = 'videos';
  const DB_VERSION = 1;
  
  // Default storage limit is 200MB
  const MAX_STORAGE_SIZE = 200 * 1024 * 1024;
  
  // Helper function to open the database
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  };
  
  // Save a video to IndexedDB
  const saveVideo = async (
    id: string, 
    videoBlob: Blob, 
    thumbnailBlob: Blob, 
    metadata: {
      title: string;
      performanceId: string;
      rehearsalId: string;
      createdAt: string;
      performers: string[];
      tags: string[];
    }
  ): Promise<boolean> => {
    try {
      // Check if we have enough space
      const totalSize = videoBlob.size + thumbnailBlob.size;
      await ensureSpace(totalSize);
      
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const item: VideoStorageItem = {
        id,
        videoBlob,
        thumbnailBlob,
        metadata
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to save video to IndexedDB:', error);
      return false;
    }
  };
  
  // Get a video from IndexedDB
  const getVideo = async (id: string): Promise<VideoStorageItem | null> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      const result = await new Promise<VideoStorageItem | undefined>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return result || null;
    } catch (error) {
      console.error('Failed to get video from IndexedDB:', error);
      return null;
    }
  };
  
  // Delete a video from IndexedDB
  const deleteVideo = async (id: string): Promise<boolean> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete video from IndexedDB:', error);
      return false;
    }
  };
  
  // List all videos in IndexedDB
  const listVideos = async (): Promise<VideoStorageItem[]> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      const result = await new Promise<VideoStorageItem[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      return result;
    } catch (error) {
      console.error('Failed to list videos from IndexedDB:', error);
      return [];
    }
  };
  
  // Clear videos older than a certain number of days
  const clearOldVideos = async (maxAgeInDays: number = 7): Promise<number> => {
    try {
      const videos = await listVideos();
      let deletedCount = 0;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
      
      for (const video of videos) {
        const videoDate = new Date(video.metadata.createdAt);
        if (videoDate < cutoffDate) {
          const success = await deleteVideo(video.id);
          if (success) deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to clear old videos:', error);
      return 0;
    }
  };
  
  // Ensure there's enough space by removing old videos if necessary
  const ensureSpace = async (requiredBytes: number): Promise<void> => {
    const videos = await listVideos();
    
    // Calculate current storage usage
    let currentUsage = videos.reduce((total, video) => {
      return total + video.videoBlob.size + video.thumbnailBlob.size;
    }, 0);
    
    // If we have enough space, just return
    if (currentUsage + requiredBytes <= MAX_STORAGE_SIZE) {
      return;
    }
    
    // Sort videos by date, oldest first
    videos.sort((a, b) => {
      return new Date(a.metadata.createdAt).getTime() - new Date(b.metadata.createdAt).getTime();
    });
    
    // Remove oldest videos until we have enough space
    for (const video of videos) {
      if (currentUsage + requiredBytes <= MAX_STORAGE_SIZE) {
        break;
      }
      
      const videoSize = video.videoBlob.size + video.thumbnailBlob.size;
      const success = await deleteVideo(video.id);
      
      if (success) {
        currentUsage -= videoSize;
      }
    }
  };
  
  return {
    saveVideo,
    getVideo,
    deleteVideo,
    listVideos,
    clearOldVideos
  };
};

// Export a singleton instance
export const videoStorage = createVideoStorage();