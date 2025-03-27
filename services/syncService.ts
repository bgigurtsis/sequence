import { v4 as uuidv4 } from 'uuid';
// import { videoStorage } from './videoStorage'; // (Unused in your snippet)
import { Performance, Recording, Metadata } from '../types';
import { googleDriveService } from '@/lib/GoogleDriveService';

// Add timestamp to logs
function logWithTimestamp(type: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][SyncService][${type}] ${message}`, data ? data : '');
}

export interface SyncQueueItem {
  id: string;
  performanceId: string;
  performanceTitle: string;
  rehearsalId: string;
  userId?: string;
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
  // We'll also add an optional flag for reloading Blobs from storage, if needed
  needsBlobReload?: boolean;
}

// Add a new interface for the storage format of queue items
interface StoredSyncQueueItem {
  id: string;
  performanceId: string;
  performanceTitle: string;
  rehearsalId: string;
  userId?: string;
  videoSize?: number;
  thumbnailSize?: number;
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
    logWithTimestamp('INIT', 'Sync service initializing');

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
    try {
      const storedState = localStorage.getItem('syncState');
      if (storedState) {
        const parsedState = JSON.parse(storedState);

        // Restore basic state properties
        this.state.lastSync = parsedState.lastSync;
        this.state.lastSuccess = parsedState.lastSuccess;
        this.state.isOnline = parsedState.isOnline ?? true;
        this.state.isSyncing = false;

        // Queue items won't have Blobs, so we need to mark them as needing reload
        if (parsedState.queue && Array.isArray(parsedState.queue)) {
          // Filter out any invalid queue items and create placeholder Blobs
          this.state.queue = parsedState.queue
            .filter((item: StoredSyncQueueItem) =>
              item && item.id && item.performanceId && item.status
            )
            .map((item: StoredSyncQueueItem) => ({
              ...item,
              // Create empty Blobs as placeholders
              video: new Blob([], { type: 'video/mp4' }),
              thumbnail: new Blob([], { type: 'image/jpeg' }),
              // Mark items as needing blob reload
              needsBlobReload: true,
              status: item.status === 'syncing' ? 'pending' : item.status
            }));

          logWithTimestamp('STORAGE', `Loaded ${this.state.queue.length} items from storage`);

          // Check for any queued items marked as completed
          const completedItems = this.state.queue.filter(item => item.status === 'completed');
          if (completedItems.length > 0) {
            logWithTimestamp('STORAGE', `Found ${completedItems.length} completed items, removing from queue`);
            this.state.queue = this.state.queue.filter(item => item.status !== 'completed');
          }
        }

        // Also restore error states if available
        if (parsedState.syncErrors && typeof parsedState.syncErrors === 'object') {
          this.syncErrors = parsedState.syncErrors;
        }

        logWithTimestamp('STORAGE', 'Sync state loaded from storage', {
          queueSize: this.state.queue.length,
          lastSync: this.state.lastSync,
          isOnline: this.state.isOnline
        });
      }
    } catch (error) {
      console.error('Error loading sync state from storage:', error);
      this.state = {
        queue: [],
        lastSync: null,
        lastSuccess: null,
        isOnline: true,
        isSyncing: false
      };
      this.syncErrors = {};
    }
  }

  private saveToStorage() {
    try {
      // Create a copy of the state to avoid modifying the original
      const stateCopy = { ...this.state };

      // Convert queue items to a storable format (removing Blobs)
      if (stateCopy.queue && Array.isArray(stateCopy.queue)) {
        const storedQueue: StoredSyncQueueItem[] = stateCopy.queue.map(item => {
          // Create a copy without Blob properties that can't be serialized
          const { video, thumbnail, needsBlobReload, ...itemWithoutBlobs } = item;

          return {
            ...itemWithoutBlobs,
            // Just store the sizes or any other info you need
            videoSize: video ? video.size : 0,
            thumbnailSize: thumbnail ? thumbnail.size : 0
          };
        });

        // Replace the queue with the storable format
        (stateCopy as any).queue = storedQueue;
      }

      // Also save error states
      const stateToSave = {
        ...stateCopy,
        syncErrors: this.syncErrors
      };

      localStorage.setItem('syncState', JSON.stringify(stateToSave));
      logWithTimestamp('STORAGE', 'Sync state saved to storage', {
        queueSize: stateCopy.queue.length,
        lastSync: stateCopy.lastSync
      });
    } catch (error) {
      console.error('Error saving sync state to storage:', error);
    }
  }

  private setOnlineStatus(isOnline: boolean) {
    if (this.state.isOnline !== isOnline) {
      logWithTimestamp('NETWORK', `Connection status changed: ${isOnline ? 'Online' : 'Offline'}`);
      this.state.isOnline = isOnline;
      this.notifyListeners();
      this.saveToStorage();

      if (isOnline && this.getPendingCount() > 0) {
        logWithTimestamp('NETWORK', 'Back online with pending items, triggering sync');
        this.sync();
      }
    }
  }

  private startSyncService() {
    logWithTimestamp('INIT', 'Starting sync service');

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

  /**
   * Sync all pending recordings to Google Drive
   * @returns Promise resolving to an array of sync results
   */
  public async sync() {
    if (this.state.isSyncing) {
      logWithTimestamp('SYNC', 'Sync already in progress, skipping');
      return { success: false, message: 'Sync already in progress' };
    }

    // Skip if offline
    if (!this.state.isOnline) {
      logWithTimestamp('SYNC', 'Device is offline, skipping sync');
      return { success: false, message: 'Device is offline' };
    }

    // Skip if no pending items
    if (this.getPendingCount() === 0) {
      logWithTimestamp('SYNC', 'No pending items to sync');
      return { success: true, message: 'No pending items' };
    }

    logWithTimestamp('SYNC', `Starting sync of ${this.getPendingCount()} pending items`);
    this.state.isSyncing = true;
    this.notifyListeners();

    try {
      // Sort items by creation date (oldest first)
      const pendingItems = [...this.state.queue]
        .filter(item => item.status === 'pending')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Limit to 1 item per sync to avoid timeout issues
      const itemToSync = pendingItems[0];
      
      // Ensure we have the blob data
      if (itemToSync.needsBlobReload) {
        // Handle blob reload if needed (using the existing code)
        // ...
      }

      // Mark item as in progress
      this.updateItemStatus(itemToSync.id, 'in-progress');
      logWithTimestamp('SYNC', `Processing item ${itemToSync.id}: ${itemToSync.metadata.title}`);
      
      // Make sure we have a valid userId
      const userId = await this.getUserId();
      if (!userId) {
        logWithTimestamp('ERROR', 'No user ID available for sync');
        this.updateItemFailure(itemToSync.id, 'User not authenticated');
        this.state.isSyncing = false;
        this.notifyListeners();
        this.saveToStorage();
        return { success: false, message: 'Authentication required' };
      }

      // Construct form data for upload
      const formData = new FormData();
      formData.append('video', itemToSync.video);
      formData.append('thumbnail', itemToSync.thumbnail);
      formData.append('performanceId', itemToSync.performanceId);
      formData.append('rehearsalId', itemToSync.rehearsalId);
      formData.append('userId', userId);
      
      // Add metadata
      Object.keys(itemToSync.metadata).forEach(key => {
        // @ts-ignore - metadata is a generic object
        const value = itemToSync.metadata[key];
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Mark as syncing
      this.updateItemStatus(itemToSync.id, 'syncing');
      
      // Attempt upload
      const uploadStartTime = Date.now();
      logWithTimestamp('UPLOAD', `Starting upload for ${itemToSync.id}`);
      
      // Use the fetch API directly with proper error handling
      const res = await fetch('/api/upload/form', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      // Handle 401 Unauthorized errors (user needs to reauthenticate)
      if (res.status === 401) {
        logWithTimestamp('AUTH', 'Authentication required for upload');
        this.updateItemFailure(itemToSync.id, 'Authentication required');
        this.state.isSyncing = false;
        this.notifyListeners();
        this.saveToStorage();
        return { success: false, message: 'Authentication required' };
      }

      // Handle other error responses
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        const errorJson = tryParseJson(errorText);
        const errorMessage = errorJson?.message || errorJson?.error || errorText || `Status ${res.status}`;
        
        logWithTimestamp('ERROR', `Upload failed: ${errorMessage}`, { status: res.status });
        this.updateItemFailure(itemToSync.id, errorMessage);
        this.state.isSyncing = false;
        this.notifyListeners();
        this.saveToStorage();
        return { success: false, message: errorMessage };
      }
      
      // Success handler
      const data = await res.json();
      const uploadDuration = Math.floor((Date.now() - uploadStartTime) / 1000);
      logWithTimestamp('SUCCESS', `Upload completed in ${uploadDuration}s: ${itemToSync.id}`, data);
      
      // Mark as completed
      this.updateItemStatus(itemToSync.id, 'completed');
      
      // Remove from queue after success
      this.state.queue = this.state.queue.filter(item => item.id !== itemToSync.id);
      
      // Update sync timestamp
      const now = new Date().toISOString();
      this.state.lastSync = now;
      this.state.lastSuccess = now;
      
      // Save state
      this.state.isSyncing = false;
      this.notifyListeners();
      this.saveToStorage();
      
      return { success: true, message: 'Upload completed', data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithTimestamp('ERROR', `Sync failed with error: ${errorMessage}`, error);
      
      // Reset syncing state
      this.state.isSyncing = false;
      this.notifyListeners();
      this.saveToStorage();
      
      return { success: false, message: errorMessage };
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
    logWithTimestamp('QUEUE', 'Clearing failed sync items');
    this.state.queue = this.state.queue.filter(item => item.status !== 'failed');
    this.notifyListeners();
    this.saveToStorage();
  }

  public retryFailedItems() {
    logWithTimestamp('QUEUE', 'Retrying failed sync items');
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

  async getUserId(): Promise<string | null> {
    try {
      logWithTimestamp('AUTH', 'Fetching user ID from /api/auth/me');

      // Update fetch to include credentials
      const userResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logWithTimestamp('AUTH', `Response from /api/auth/me - Status: ${userResponse.status} ${userResponse.statusText}`);

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          logWithTimestamp('AUTH', 'Authentication required, no user ID found');
          return null;
        }

        logWithTimestamp('AUTH', `Error fetching user ID: ${userResponse.status}`);
        return null;
      }

      const userData = await userResponse.json();

      if (!userData.userId) {
        logWithTimestamp('AUTH', 'No userId returned from /api/auth/me', userData);
        return null;
      }

      return userData.userId;
    } catch (error: any) {
      logWithTimestamp('AUTH', `Error fetching user ID: ${error.message}`);
      return null;
    }
  }
}

// Helper function to parse JSON with error handling
function tryParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

export const syncService = new SyncService();
