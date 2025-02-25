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
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
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
    this.loadFromStorage();
    
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));
    
    // Check initial online status
    this.setOnlineStatus(navigator.onLine);
  }

  private loadFromStorage() {
    try {
      const savedState = localStorage.getItem('syncState');
      if (savedState) {
        console.log('Loading sync state from storage');
        
        // Parse stored sync state
        const parsedState = JSON.parse(savedState) as SyncState;
        
        // We need to handle queue specially because Blobs aren't serialized in localStorage
        // Only keep the items that haven't been completed yet
        this.state = {
          ...parsedState,
          queue: [],
          isSyncing: false // Reset syncing status on load
        };
        
        // Load queue from IndexedDB
        const queuedItems = localStorage.getItem('syncQueue');
        if (queuedItems) {
          try {
            const parsedItems = JSON.parse(queuedItems) as Omit<SyncQueueItem, 'video' | 'thumbnail'>[];
            console.log(`Found ${parsedItems.length} items in sync queue`);
            
            // We don't restore the actual queue items with blobs here - just metadata
            // The blobs are stored separately in IndexedDB
            
            this.state.queue = parsedItems.map(item => ({
              ...item,
              video: new Blob([], { type: 'video/mp4' }), // Placeholder blob
              thumbnail: new Blob([], { type: 'image/jpeg' }), // Placeholder blob
            }));
            
            console.log('Sync queue loaded (without actual blobs)');
          } catch (e) {
            console.error('Failed to parse sync queue:', e);
          }
        }
        
        console.log('Sync state loaded:', {
          queueLength: this.state.queue.length,
          lastSync: this.state.lastSync,
          lastSuccess: this.state.lastSuccess,
          isOnline: this.state.isOnline
        });
      } else {
        console.log('No saved sync state found, starting fresh');
      }
      
      this.initialized = true;
      this.notifyListeners();
      this.startSyncInterval();
    } catch (e) {
      console.error('Failed to load sync state:', e);
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

  private startSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Sync every 5 minutes if there are pending items
    this.syncInterval = setInterval(() => {
      if (this.getPendingCount() > 0 && this.state.isOnline && !this.state.isSyncing) {
        console.log('Auto-sync interval triggered with pending items');
        this.sync();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('Sync interval started - will check every 5 minutes');
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
    
    if (!this.state.isOnline) {
      console.log('Offline, cannot sync');
      return;
    }
    
    const pendingItems = this.state.queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      return;
    }
    
    console.log(`Starting sync of ${pendingItems.length} items`);
    this.state.isSyncing = true;
    this.state.lastSync = new Date().toISOString();
    this.notifyListeners();
    this.saveToStorage();
    
    let syncSuccess = false;
    
    for (const item of pendingItems) {
      if (!this.state.isOnline) {
        console.log('Connection lost during sync, stopping');
        break;
      }
      
      console.log(`Processing item ${item.id}: "${item.metadata.title}"`);
      
      // Update item status
      item.status = 'in-progress';
      item.lastAttempt = new Date().toISOString();
      item.attemptCount++;
      delete item.error;
      this.notifyListeners();
      
      try {
        console.log('Creating form data for upload');
        const formData = new FormData();
        formData.append('video', item.video, `${item.metadata.title}.mp4`);
        formData.append('thumbnail', item.thumbnail, `${item.metadata.title}_thumb.jpg`);
        formData.append('performanceId', item.performanceId);
        formData.append('performanceTitle', item.performanceTitle);
        formData.append('rehearsalId', item.rehearsalId);
        formData.append('rehearsalTitle', item.metadata.rehearsalTitle || 'Untitled Rehearsal');
        formData.append('recordingTitle', item.metadata.title);
        formData.append('recordingMetadata', JSON.stringify(item.metadata));
        
        console.log('Sending upload request to server');
        console.log('Upload details:', {
          performanceId: item.performanceId,
          performanceTitle: item.performanceTitle,
          rehearsalId: item.rehearsalId,
          rehearsalTitle: item.metadata.rehearsalTitle,
          recordingTitle: item.metadata.title,
          videoSize: `${Math.round(item.video.size / 1024 / 1024 * 100) / 100}MB`
        });
        
        // Test the API endpoint before sending the full request
        console.log('Testing API endpoint with a ping');
        const pingRes = await fetch('/api/ping', {
          method: 'GET',
        });
        
        if (!pingRes.ok) {
          console.error('API endpoint test failed:', pingRes.status, pingRes.statusText);
          throw new Error(`API endpoint test failed: ${pingRes.status} ${pingRes.statusText}`);
        }
        
        console.log('API endpoint test succeeded, proceeding with upload');
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Upload failed:', {
            status: res.status,
            statusText: res.statusText, 
            error: errorText
          });
          throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${errorText}`);
        }
        
        const result = await res.json();
        console.log('Upload successful:', result);
        
        // Mark item as completed
        item.status = 'completed';
        this.state.lastSuccess = new Date().toISOString();
        syncSuccess = true;
      } catch (error) {
        console.error('Sync error for item:', item.id, error);
        item.status = 'failed';
        item.error = error instanceof Error ? error.message : String(error);
      }
      
      this.notifyListeners();
      this.saveToStorage();
    }
    
    // Clean up completed items
    this.state.queue = this.state.queue.filter(item => item.status !== 'completed');
    
    this.state.isSyncing = false;
    this.notifyListeners();
    this.saveToStorage();
    
    console.log('Sync completed', {
      success: syncSuccess,
      pendingCount: this.getPendingCount(),
      failedCount: this.getFailedCount()
    });
    
    return syncSuccess;
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