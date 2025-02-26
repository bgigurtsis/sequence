import { v4 as uuidv4 } from 'uuid';
import { videoStorage } from './videoStorage';
import { Performance, Recording, Metadata } from '../types';

export interface SyncQueueItem {
  id: string;
  performanceId: string;
  performanceTitle: string;
  rehearsalId: string;
  video: Blob;
  thumbnail: Blob;
  metadata: {
    title: string;
    time: string;
    performers: string[];
    notes?: string;
    rehearsalId: string;
    tags?: string[];
    rehearsalTitle?: string;
  };
  createdAt: string;

  attemptCount: number;
  lastAttempt?: string;
  error?: string;
  status: 'pending' | 'in-progress' | 'syncing' | 'completed' | 'failed';
}

interface SyncState {
  queue: SyncQueueItem[];
  lastSync: string | null;
  lastSuccess: string | null;
  isOnline: boolean;
  isSyncing: boolean;
}

class SyncService {
  private state: SyncState = {
    queue: [],
    lastSync: null,
    lastSuccess: null,
    isOnline: true,
    isSyncing: false,
  };
  private listeners: (() => void)[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    console.log('Sync service initializing');
    
    // Only proceed with client-side operations
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
      
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
      
      // Check initial online status
      this.setOnlineStatus(navigator.onLine);
      
      // Start sync service
      this.startSyncService();
    }
  }

  private loadFromStorage() {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      const savedState = localStorage.getItem('syncState');
      if (savedState) {
        console.log('Loading sync state from storage');
        
        // Parse stored sync state
        const parsedState = JSON.parse(savedState) as SyncState;
        
        // We need to handle queue specially because Blobs aren't serialized in localStorage
        // Safely handle the case where queue might be undefined
        this.state = {
          ...parsedState,
          queue: parsedState.queue ? parsedState.queue.filter(item => item.status !== 'completed') : []
        };
      }
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  }

  private saveToStorage() {
    try {
      // Save basic sync state
      const stateToSave = {
        lastSync: this.state.lastSync,
        lastSuccess: this.state.lastSuccess,
        isOnline: this.state.isOnline,
        isSyncing: false
      };
      
      localStorage.setItem('syncState', JSON.stringify(stateToSave));
      
      // Save queue metadata (without blobs)
      const queueMetadata = this.state.queue.map(item => {
        const { video, thumbnail, ...rest } = item;
        return rest;
      });
      
      localStorage.setItem('syncQueue', JSON.stringify(queueMetadata));
      console.log('Sync state saved to storage');
    } catch (e) {
      console.error('Failed to save sync state:', e);
    }
  }

  private setOnlineStatus(isOnline: boolean) {
    if (this.state.isOnline !== isOnline) {
      console.log(`Connection status changed: ${isOnline ? 'Online' : 'Offline'}`);
      this.state.isOnline = isOnline;
      this.notifyListeners();
      this.saveToStorage();
      
      if (isOnline && this.getPendingCount() > 0) {
        console.log('Back online with pending items, triggering sync');
        this.sync();
      }
    }
  }

  private startSyncService() {
    console.log('Starting sync service');
    
    // Run initial sync check
    if (this.state.isOnline) {
      this.sync();
    }
    
    // Set up interval for periodic sync attempts
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.state.isOnline && !this.state.isSyncing) {
        this.sync();
      }
    }, 60000); // Check every minute
  }

  public queueRecording(
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    video: Blob,
    thumbnail: Blob,
    metadata: any
  ) {
    console.log('Queueing recording for sync:', {
      performanceId,
      performanceTitle,
      rehearsalId,
      videoSize: `${Math.round(video.size / 1024 / 1024 * 100) / 100}MB`,
      thumbnailSize: `${Math.round(thumbnail.size / 1024)}KB`,
      metadata
    });
    
    const item: SyncQueueItem = {
      id: uuidv4(),
      performanceId,
      performanceTitle,
      rehearsalId,
      video,
      thumbnail,
      metadata,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending'
    };
    
    this.state.queue.push(item);
    this.notifyListeners();
    this.saveToStorage();
    
    console.log('Item added to sync queue, current queue size:', this.state.queue.length);
    
    // Try to sync immediately if online
    if (this.state.isOnline && !this.state.isSyncing) {
      console.log('Online and not syncing, triggering immediate sync');
      this.sync();
    } else {
      console.log('Not syncing immediately:', {
        isOnline: this.state.isOnline,
        isSyncing: this.state.isSyncing
      });
    }
  }

  public async sync() {
    if (this.state.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    const pendingItems = this.state.queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      return;
    }
    
    console.log(`Starting sync with ${pendingItems.length} pending items`);
    
    this.state.isSyncing = true;
    this.state.lastSync = new Date().toISOString();
    this.notifyListeners();
    
    let syncSuccess = false;
    
    for (const item of pendingItems) {
      console.log(`Syncing item: ${item.id}`);
      
      item.status = 'syncing';
      item.attemptCount += 1;
      this.notifyListeners();
      
      try {
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('video', item.video, 'recording.mp4');
        formData.append('thumbnail', item.thumbnail, 'thumbnail.jpg');
        formData.append('performanceTitle', item.performanceTitle);
        formData.append('recordingTitle', item.metadata.title || 'Untitled Recording');
        
        if (item.metadata.rehearsalTitle) {
          formData.append('rehearsalTitle', item.metadata.rehearsalTitle);
        }
        
        console.log('Uploading recording to server');
        
        // Upload to server
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        // Clone the response before reading it
        const responseClone = response.clone();
        
        // Check response status
        if (!response.ok) {
          const errorData = await responseClone.text();
          console.error('Upload failed with status:', response.status, errorData);
          
          // Special handling for auth errors
          if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication error. Please reconnect your Google Drive in Settings.');
          }
          
          throw new Error(`Upload failed with status ${response.status}: ${errorData}`);
        }
        
        // Parse successful response
        const result = await response.json();
        console.log('Upload successful:', result);
        item.status = 'completed';
        syncSuccess = true;
      } catch (error) {
        console.error('Sync error for item:', item.id, error);
        item.status = 'failed';
        item.error = error instanceof Error ? error.message : String(error);
      }
      
      this.notifyListeners();
      this.saveToStorage();
    }
    
    this.state.isSyncing = false;
    
    if (syncSuccess) {
      this.state.lastSuccess = new Date().toISOString();
    }
    
    this.notifyListeners();
    this.saveToStorage();
    
    console.log('Sync completed');
  }

  public getPendingCount() {
    return this.state.queue.filter(item => item.status === 'pending').length;
  }

  public getInProgressCount() {
    return this.state.queue.filter(item => item.status === 'in-progress').length;
  }

  public getFailedCount() {
    return this.state.queue.filter(item => item.status === 'failed').length;
  }
  
  public getFailedItems() {
    return this.state.queue.filter(item => item.status === 'failed');
  }

  public getLastSync() {
    return this.state.lastSync;
  }

  public getLastSuccess() {
    return this.state.lastSuccess;
  }

  public isOnline() {
    return this.state.isOnline;
  }

  public isSyncing() {
    return this.state.isSyncing;
  }

  public clearFailedItems() {
    console.log('Clearing failed sync items');
    this.state.queue = this.state.queue.filter(item => item.status !== 'failed');
    this.notifyListeners();
    this.saveToStorage();
  }

  public retryFailedItems() {
    console.log('Retrying failed sync items');
    this.state.queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
        delete item.error;
      }
    });
    this.notifyListeners();
    this.saveToStorage();
    
    if (this.state.isOnline) {
      this.sync();
    }
  }

  public getState() {
    return {
      pendingCount: this.getPendingCount(),
      inProgressCount: this.getInProgressCount(),
      failedCount: this.getFailedCount(),
      lastSync: this.state.lastSync,
      lastSuccess: this.state.lastSuccess,
      isOnline: this.state.isOnline,
      isSyncing: this.state.isSyncing,
    };
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

export const syncService = new SyncService();