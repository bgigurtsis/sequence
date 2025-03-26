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
   * Validate authentication for upload
   * Makes sure user is authenticated before attempting uploads
   * @returns True if authenticated, false otherwise
   */
  private async validateAuthForUpload(): Promise<boolean> {
    try {
      // First try to use the global validation function if available (most comprehensive)
      if (typeof window !== 'undefined' && window.validateAllTokensForRecording) {
        logWithTimestamp('AUTH', 'Using global validateAllTokensForRecording for upload validation');
        const tokensValid = await window.validateAllTokensForRecording();
        
        if (!tokensValid) {
          logWithTimestamp('AUTH', 'Token validation failed via global validator');
          return false;
        }
        return true;
      }

      // If global validator not available, use direct API check
      logWithTimestamp('AUTH', 'Fetching user ID from /api/auth/me');
      
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include' // Important for sending cookies/auth tokens
      });

      if (!res.ok) {
        logWithTimestamp('AUTH', `Authentication check failed with status ${res.status}`);
        
        // If it's a 401, try to refresh the session and try once more
        if (res.status === 401 && typeof window !== 'undefined' && window.refreshBeforeCriticalOperation) {
          logWithTimestamp('AUTH', 'Attempting session refresh after 401');
          const refreshSuccess = await window.refreshBeforeCriticalOperation(false);
          
          if (refreshSuccess) {
            // Try the auth check again
            const secondRes = await fetch('/api/auth/me', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              credentials: 'include'
            });
            
            if (secondRes.ok) {
              logWithTimestamp('AUTH', 'Authentication succeeded after session refresh');
              return true;
            }
          }
          
          logWithTimestamp('AUTH', 'Authentication still failed after session refresh');
          return false;
        }
        
        return false;
      }

      const data = await res.json();
      
      logWithTimestamp('AUTH', `User ID fetched: ${data?.userId ? 'Success' : 'Missing'}`);
      
      return Boolean(data?.userId);
    } catch (error) {
      logWithTimestamp('ERROR', 'Authentication check failed', error);
      return false;
    }
  }

  public async queueRecording(
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    video: Blob,
    thumbnail: Blob,
    metadata: any
  ) {
    // Validate authentication before proceeding
    const isAuthenticated = await this.validateAuthForUpload();
    if (!isAuthenticated) {
      logWithTimestamp('QUEUE', 'Cannot queue recording: Authentication failed');
      return;
    }

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
    if (this.state.isSyncing) {
      logWithTimestamp('SYNC', 'Sync already in progress, skipping');
      return;
    }

    try {
      this.state.isSyncing = true;
      this.notifyListeners();

      // Process any pending items
      const pendingItems = this.state.queue.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) {
        logWithTimestamp('SYNC', 'No pending items to sync');
        this.state.isSyncing = false;
        this.notifyListeners();
        return;
      }

      logWithTimestamp('SYNC', `Starting sync for ${pendingItems.length} pending items`);

      // Process one item at a time
      const itemToSync = pendingItems[0];

      // Update status
      this.updateItemStatus(itemToSync.id, 'in-progress');

      // Check if we have a cached userId in session storage
      const cachedUserId = sessionStorage.getItem('userId');
      let userId = null;

      if (cachedUserId) {
        logWithTimestamp('SYNC', `Using cached userId: ${cachedUserId}`);
        userId = cachedUserId;
      } else {
        // 1) Get user ID from /api/auth/me
        logWithTimestamp('SYNC', 'Making fetch request to /api/auth/me');
        const userResponse = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            // Add cache control headers
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        logWithTimestamp('SYNC', `User response status: ${userResponse.status} ${userResponse.statusText}`);

        if (userResponse.ok) {
          const userData = await userResponse.json();
          logWithTimestamp('SYNC', `User data received: ${JSON.stringify(userData)}`);

          if (userData.userId) {
            userId = userData.userId;
            // Cache userId for future use
            sessionStorage.setItem('userId', userId);
            logWithTimestamp('SYNC', `Got user ID: ${userId}`);
          } else {
            logWithTimestamp('SYNC', 'User data received, but no userId found', userData);
          }
        } else {
          const errorData = await userResponse.json();
          logWithTimestamp('SYNC', `Authentication error: ${JSON.stringify(errorData)}`);

          // Check if we need to redirect to sign-in
          if (userResponse.status === 401) {
            // Check if we've already shown an auth error recently to prevent spam
            const lastAuthError = sessionStorage.getItem('lastAuthError');
            const now = new Date().getTime();

            if (!lastAuthError || now - new Date(lastAuthError).getTime() > 60000) {
              // Store the error time to prevent multiple alerts
              sessionStorage.setItem('lastAuthError', new Date().toISOString());

              logWithTimestamp('SYNC', 'Authentication required, user needs to sign in');
              this.state.isSyncing = false;
              this.notifyListeners();

              // Display a user-facing error
              alert('Your session has expired. Please sign in again to continue uploading recordings.');

              // Redirect to sign-in
              window.location.href = '/sign-in';
              return;
            } else {
              logWithTimestamp('SYNC', 'Auth error already shown recently, not showing again');
              this.state.isSyncing = false;
              this.notifyListeners();
              return;
            }
          }
        }
      }

      // If no userId, use performanceId as fallback (only for this upload session)
      if (!userId) {
        logWithTimestamp('SYNC', `⚠️ No user ID found, using performanceId as fallback: ${itemToSync.performanceId}`);
        userId = itemToSync.performanceId.substring(0, 4); // Use a prefix of the performance ID
      }

      logWithTimestamp('SYNC', `Final user ID for sync: ${userId}`);

      // Create form data for the upload
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('performanceId', itemToSync.performanceId);
      formData.append('performanceTitle', itemToSync.performanceTitle);
      formData.append('rehearsalId', itemToSync.rehearsalId);
      formData.append('recordingId', itemToSync.id);
      formData.append('metadata', JSON.stringify(itemToSync.metadata));
      formData.append('video', itemToSync.video);
      formData.append('thumbnail', itemToSync.thumbnail);

      logWithTimestamp('SYNC', `Uploading recording ${itemToSync.id} for user ${userId}`);
      logWithTimestamp('SYNC', 'Making POST request to /api/upload/form');

      const uploadResponse = await fetch('/api/upload/form', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Don't set Content-Type header here - the browser will set it correctly with the multipart boundary
      });

      logWithTimestamp('SYNC', `Upload response status: ${uploadResponse.status} ${uploadResponse.statusText}`);

      const uploadResult = await uploadResponse.json();
      logWithTimestamp('SYNC', `Upload result: ${JSON.stringify(uploadResult)}`);

      if (!uploadResponse.ok) {
        // Handle authentication errors specifically
        if (uploadResponse.status === 401) {
          // Check if we've already shown an auth error recently
          const lastAuthError = sessionStorage.getItem('lastAuthError');
          const now = new Date().getTime();

          if (!lastAuthError || now - new Date(lastAuthError).getTime() > 60000) {
            // Store the error time to prevent multiple alerts
            sessionStorage.setItem('lastAuthError', new Date().toISOString());

            logWithTimestamp('SYNC', 'Authentication required for upload, user needs to sign in');
            this.state.isSyncing = false;
            this.notifyListeners();

            // Clear cached userId as it's no longer valid
            sessionStorage.removeItem('userId');

            // Display a user-facing error
            alert('Your session has expired. Please sign in again to continue uploading recordings.');

            // Redirect to sign-in
            window.location.href = '/sign-in';
          } else {
            logWithTimestamp('SYNC', 'Auth error already shown recently, not showing again');
            this.state.isSyncing = false;
            this.notifyListeners();
          }

          throw new Error(uploadResult.error || 'Authentication required');
        }

        // For other errors, mark as failed and retry later
        this.updateItemFailure(itemToSync.id, uploadResult.error || 'Unknown error uploading recording');
        throw new Error(uploadResult.error || 'Error uploading recording');
      }

      // Success - mark item as completed
      logWithTimestamp('SYNC', `Upload successful for recording ${itemToSync.id}`);
      this.updateItemStatus(itemToSync.id, 'completed');

      // Update last success timestamp
      this.state.lastSuccess = new Date().toISOString();
    } catch (error: any) {
      logWithTimestamp('SYNC', `Sync error: ${error.message}`);
      // Note: Individual item failures are handled within the try block
      throw error;
    } finally {
      // Update last sync timestamp and save state
      this.state.lastSync = new Date().toISOString();
      this.state.isSyncing = false;
      this.notifyListeners();
      this.saveToStorage();
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

export const syncService = new SyncService();
