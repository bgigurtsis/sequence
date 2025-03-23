import { v4 as uuidv4 } from 'uuid';
// import { videoStorage } from './videoStorage'; // (Unused in your snippet)
import { Performance, Recording, Metadata } from '../types';
import { getGoogleRefreshToken } from '@/lib/clerkAuth';
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

  public queueRecording(
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    video: Blob,
    thumbnail: Blob,
    metadata: any
  ) {
    // Try to get the current user ID to store with the item
    let userId: string | undefined;

    // Create a unique ID for this sync item
    const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    // Get video and thumbnail size for logging
    const videoSize = `${(video.size / (1024 * 1024)).toFixed(2)}MB`;
    const thumbnailSize = `${(thumbnail.size / 1024).toFixed(0)}KB`;

    logWithTimestamp('QUEUE', `Queueing recording for sync: ${id}`, {
      performanceId,
      performanceTitle,
      rehearsalId,
      videoSize,
      thumbnailSize,
      metadata
    });

    // Attempt to get current user ID asynchronously
    logWithTimestamp('AUTH', 'Fetching user ID from /api/auth/me');

    fetch('/api/auth/me')
      .then(response => {
        logWithTimestamp('AUTH', `Response from /api/auth/me - Status: ${response.status} ${response.statusText}`);
        logWithTimestamp('AUTH', 'Response headers:', Object.fromEntries(response.headers.entries()));

        // If the endpoint returns HTML instead of JSON, this will throw:
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          logWithTimestamp('AUTH', `Error: Expected JSON, got: ${contentType || 'unknown'}`);
          // Try to get the response text to see what we're actually getting
          return response.text().then(text => {
            logWithTimestamp('AUTH', 'Response body (not JSON):', text.substring(0, 200) + '...');
            throw new Error(`Expected JSON, got: ${contentType || 'unknown'}`);
          });
        }
        return response.json();
      })
      .then(data => {
        logWithTimestamp('AUTH', 'User data received:', data);
        if (data && data.userId) {
          userId = data.userId;
          logWithTimestamp('AUTH', `Found user ID for sync item: ${userId}`);

          // Update the item in the queue with the userId if we already added it
          const existingItemIndex = this.state.queue.findIndex(item => item.id === id);
          if (existingItemIndex !== -1) {
            this.state.queue[existingItemIndex].userId = userId;
            this.saveToStorage();
            logWithTimestamp('AUTH', `Updated existing queue item with user ID: ${userId}`);
          }
        } else {
          logWithTimestamp('AUTH', 'No userId returned from /api/auth/me', data);
        }
      })
      .catch(error => {
        logWithTimestamp('AUTH', 'Could not get user ID when queueing item:', error.toString());
      });

    // Create the sync item
    const syncItem: SyncQueueItem = {
      id,
      performanceId,
      performanceTitle,
      rehearsalId,
      userId, // This might be undefined initially
      video,
      thumbnail,
      metadata,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending'
    };

    // Add to queue
    this.state.queue.push(syncItem);
    this.saveToStorage();

    logWithTimestamp('QUEUE', `Item added to sync queue, current queue size: ${this.state.queue.length}`);

    // If we're online and not currently syncing, trigger a sync
    if (this.state.isOnline && !this.state.isSyncing) {
      logWithTimestamp('SYNC', 'Online and not syncing, triggering immediate sync');
      this.sync();
    }

    return id;
  }

  public async sync() {
    if (this.state.isSyncing || !this.state.isOnline) {
      logWithTimestamp('SYNC', `Sync aborted: ${this.state.isSyncing ? 'Already syncing' : 'Offline'}`);
      return;
    }

    if (this.state.queue.length === 0) {
      logWithTimestamp('SYNC', 'Nothing to sync');
      return;
    }

    this.state.isSyncing = true;
    this.notifyListeners();
    logWithTimestamp('SYNC', 'Starting sync process');

    try {
      // 1) Get user ID from /api/auth/me
      logWithTimestamp('SYNC', 'Making fetch request to /api/auth/me');
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Accept': 'application/json'
        }
      });

      logWithTimestamp('SYNC', `User response status: ${userResponse.status} ${userResponse.statusText}`);
      logWithTimestamp('SYNC', 'Response headers:', Object.fromEntries(userResponse.headers.entries()));

      // Check content type to ensure we're getting JSON
      {
        const contentType = userResponse.headers.get('content-type');
        logWithTimestamp('SYNC', `Content-Type of response: ${contentType}`);

        if (!contentType || !contentType.includes('application/json')) {
          const htmlResponse = await userResponse.text();
          logWithTimestamp('SYNC', 'API returned non-JSON content:', htmlResponse.substring(0, 500) + '...');
          throw new Error('API returned HTML instead of JSON');
        }
      }

      const userData = await userResponse.json();
      logWithTimestamp('SYNC', 'User data received:', userData);

      let userId = userData.userId;

      if (!userId) {
        // Try getting userId from the first item in queue
        const firstItem = this.state.queue[0];
        if (firstItem?.userId) {
          userId = firstItem.userId;
          logWithTimestamp('SYNC', 'Using userId from queue item:', userId);
        } else if (firstItem?.performanceId) {
          // Fallback if absolutely necessary (not recommended):
          userId = firstItem.performanceId.split('-')[0];
          logWithTimestamp('SYNC', '⚠️ No user ID found, using performanceId as fallback:', firstItem.performanceId);
        } else {
          throw new Error('No user ID available for sync');
        }
      }

      logWithTimestamp('SYNC', 'Final user ID for sync:', userId);

      // 2) Process each item in the queue
      for (const item of this.state.queue) {
        if (!item) continue;

        logWithTimestamp('SYNC', `Uploading recording ${item.id} for user ${userId}`);

        // Create FormData for the upload
        const formData = new FormData();
        formData.append('recordingId', item.id);
        formData.append('performanceId', item.performanceId);
        formData.append('performanceTitle', item.performanceTitle || '');
        formData.append('userId', userId);

        if (item.video) {
          formData.append('video', item.video);
        }
        if (item.thumbnail) {
          formData.append('thumbnail', item.thumbnail);
        }

        // Add metadata as JSON string
        const metadata = {
          ...item,
          video: undefined,
          thumbnail: undefined,
          videoSize: item.video ? item.video.size : undefined,
          thumbnailSize: item.thumbnail ? item.thumbnail.size : undefined
        };
        formData.append('metadataString', JSON.stringify(metadata));

        // 3) Upload to form endpoint
        logWithTimestamp('SYNC', 'Making POST request to /api/upload/form');
        const uploadResponse = await fetch('/api/upload/form', {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });

        logWithTimestamp('SYNC', `Upload response status: ${uploadResponse.status} ${uploadResponse.statusText}`);
        logWithTimestamp('SYNC', 'Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));

        // Check content type to ensure we're getting JSON
        {
          const uploadContentType = uploadResponse.headers.get('content-type');
          logWithTimestamp('SYNC', `Content-Type of upload response: ${uploadContentType}`);

          if (!uploadContentType || !uploadContentType.includes('application/json')) {
            const htmlResponse = await uploadResponse.text();
            logWithTimestamp('SYNC', 'Received non-JSON response from upload endpoint:', htmlResponse.substring(0, 500) + '...');
            throw new Error('Server returned HTML instead of JSON');
          }
        }

        const result = await uploadResponse.json();
        logWithTimestamp('SYNC', 'Upload result:', result);

        if (!uploadResponse.ok) {
          throw new Error(result.error || 'Upload failed');
        }

        // Remove successful upload from queue
        logWithTimestamp('SYNC', `Upload successful for item ${item.id}, removing from queue`);
        this.state.queue = this.state.queue.filter(qItem => qItem?.id !== item.id);
        this.state.lastSuccess = new Date().toISOString();
        this.saveToStorage();
      }

      logWithTimestamp('SYNC', 'Sync completed successfully');
    } catch (error) {
      logWithTimestamp('SYNC', 'Sync error:', error instanceof Error ? error.message : String(error));
      throw error; // Ensure the error surfaces
    } finally {
      this.state.lastSync = new Date().toISOString();
      this.state.isSyncing = false;
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
      this.logWithTimestamp('AUTH', 'Fetching user ID from /api/auth/me');

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      this.logWithTimestamp('AUTH', `Response from /api/auth/me - Status: ${response.status} ${response.statusText}`);
      this.logWithTimestamp('AUTH', `Response headers:`, Object.fromEntries(response.headers.entries()));

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // If not JSON, get the text to see what was returned
        const body = await response.text();
        this.logWithTimestamp('AUTH', `Error: Expected JSON, got: ${contentType}`, { bodyPreview: body.substring(0, 200) });
        throw new Error(`Expected JSON, got: ${contentType}`);
      }

      const data = await response.json();

      if (!data.authenticated) {
        this.logWithTimestamp('AUTH', 'User not authenticated', { data });
        return null;
      }

      this.logWithTimestamp('AUTH', 'Successfully retrieved user ID', { userId: data.userId });
      return data.userId;
    } catch (error) {
      this.logWithTimestamp('AUTH', `Could not get user ID: ${error.message}`);
      return null;
    }
  }
}

export const syncService = new SyncService();
