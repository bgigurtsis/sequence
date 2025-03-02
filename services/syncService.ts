import { v4 as uuidv4 } from 'uuid';
import { videoStorage } from './videoStorage';
import { Performance, Recording, Metadata } from '../types';
import { getGoogleRefreshToken } from '@/lib/clerkAuth';
import { checkGoogleDriveConnection } from '@/lib/googleDrive';

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
  
  // Initialize syncErrors as an empty object
  private syncErrors: Record<string, string> = {};
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
    if (this.state.isOffline) {
      console.log('Offline, skipping sync');
      return;
    }

    if (this.state.isSyncing) {
      console.log('Already syncing, skipping');
      return;
    }

    this.state.isSyncing = true;
    this.saveToStorage();

    try {
      // Check if there are items to sync
      if (!this.state.queue || this.state.queue.length === 0) {
        console.log('No items in sync queue');
        this.state.isSyncing = false;
        this.saveToStorage();
        return;
      }

      // Get the first item in the queue
      const item = this.state.queue[0];
      
      if (!item) {
        console.log('Item at index 0 is undefined, cleaning queue');
        // Remove undefined items
        this.state.queue = this.state.queue.filter(Boolean);
        this.saveToStorage();
        this.state.isSyncing = false;
        return;
      }

      console.log(`Syncing item: ${item.id}`);
      
      // Get the current user
      let userId;
      try {
        const userResponse = await fetch('/api/auth/me');
        if (!userResponse.ok) {
          throw new Error(`Failed to get current user: ${userResponse.status} ${userResponse.statusText}`);
        }
        
        const userData = await userResponse.json();
        userId = userData.userId;
        
        if (!userId) {
          throw new Error('No user ID found, user may not be authenticated');
        }
        
        console.log(`Syncing with user ID: ${userId}`);
      } catch (userError) {
        console.error('User authentication error:', userError);
        // Initialize syncErrors if it's undefined
        if (!this.syncErrors) this.syncErrors = {};
        this.syncErrors[item.id] = `Authentication error: ${userError instanceof Error ? userError.message : String(userError)}`;
        this.state.isSyncing = false;
        this.saveToStorage();
        return;
      }

      // Upload the recording
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...item,
            userId: userId
          })
        });

        if (!response.ok) {
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || `Upload failed: ${response.status}`;
          } catch (jsonError) {
            // Try to get text if JSON parsing fails
            try {
              const errorText = await response.text();
              // If response looks like HTML
              if (errorText.includes('<!DOCTYPE') || errorText.includes('<html>')) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
              } else {
                errorMessage = errorText || `Upload failed: ${response.status}`;
              }
            } catch (textError) {
              errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
            }
          }
          
          throw new Error(errorMessage);
        }

        // Parse the response, handling potential HTML/text responses
        let result;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
        } else {
          const text = await response.text();
          console.warn('Received non-JSON response:', text.substring(0, 100) + '...');
          if (text.includes('<!DOCTYPE') || text.includes('<html>')) {
            throw new Error('Received HTML instead of JSON. Server may be returning an error page.');
          }
          // Try to parse it anyway
          try {
            result = JSON.parse(text);
          } catch (e) {
            throw new Error(`Invalid response format: ${text.substring(0, 100)}...`);
          }
        }
        
        console.log('Upload result:', result);

        // Remove the item from the queue
        this.state.queue = this.state.queue.slice(1);
        this.state.lastSuccess = new Date().toISOString();
        this.saveToStorage();

        // Continue syncing if there are more items
        if (this.state.queue.length > 0) {
          setTimeout(() => this.sync(), 1000); // Small delay before next sync
        } else {
          console.log('Sync complete');
        }
      } catch (error) {
        console.error('Sync error:', error);
        // Initialize syncErrors if it's undefined
        if (!this.syncErrors) this.syncErrors = {};
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.syncErrors[item.id] = errorMessage;
        
        // Update item's attempt count and status
        if (item) {
          item.attemptCount = (item.attemptCount || 0) + 1;
          item.lastAttempt = new Date().toISOString();
          item.error = errorMessage;
          item.status = 'failed';
          this.saveToStorage();
        }
      }
    } catch (error) {
      console.error('Unexpected sync error:', error);
    } finally {
      this.state.lastSync = new Date().toISOString();
      this.state.isSyncing = false;
      this.saveToStorage();
      this.notifyListeners();
    }
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

  private updateItemStatus(itemId: string, status: SyncQueueItem['status']) {
    const item = this.state.queue.find(i => i.id === itemId);
    if (item) {
      item.status = status;
      this.notifyListeners();
      this.saveToStorage();
    }
  }

  private updateItemFailure(itemId: string, error: string) {
    this.updateItemStatus(itemId, 'failed');
    const item = this.state.queue.find(i => i.id === itemId);
    if (item) {
      item.error = error;
      this.notifyListeners();
      this.saveToStorage();
    }
  }
}

export const syncService = new SyncService();