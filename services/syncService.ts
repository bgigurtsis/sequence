import { videoStorage } from './videoStorage';
import { Performance, Recording, Metadata } from '../types';

interface SyncItem {
  id: string;
  type: 'recording' | 'metadata' | 'delete';
  performanceId: string;
  rehearsalId: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'failed' | 'completed';
  retryCount: number;
  error?: string;
}

interface SyncStats {
  pending: number;
  inProgress: number;
  failed: number;
  completed: number;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  isOnline: boolean;
}

class SyncService {
  private syncQueue: SyncItem[] = [];
  private isProcessing: boolean = false;
  private syncStats: SyncStats = {
    pending: 0,
    inProgress: 0,
    failed: 0,
    completed: 0,
    lastSyncAttempt: null,
    lastSuccessfulSync: null,
    isOnline: navigator.onLine
  };
  private listeners: Set<(stats: SyncStats) => void> = new Set();
  private localOnly: boolean = true; // Set to true for local-only mode

  constructor() {
    // Load queue from local storage
    this.loadQueue();
    
    // Setup network listeners
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
    
    // Process queue periodically
    setInterval(() => this.processQueue(), 30000); // Every 30 seconds
  }

  // Network status handler
  private handleNetworkChange = () => {
    this.syncStats.isOnline = navigator.onLine;
    if (navigator.onLine) {
      this.processQueue(); // Try to process queue when we come back online
    }
    this.notifyListeners();
  };

  // Load queue from localStorage
  private loadQueue(): void {
    try {
      const savedQueue = localStorage.getItem('syncQueue');
      if (savedQueue) {
        this.syncQueue = JSON.parse(savedQueue);
        this.updateStats();
      }
      
      const savedStats = localStorage.getItem('syncStats');
      if (savedStats) {
        this.syncStats = {...this.syncStats, ...JSON.parse(savedStats)};
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  // Save queue to localStorage
  private saveQueue(): void {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
      this.updateStats();
      localStorage.setItem('syncStats', JSON.stringify(this.syncStats));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Update sync statistics
  private updateStats(): void {
    this.syncStats.pending = this.syncQueue.filter(item => item.status === 'pending').length;
    this.syncStats.inProgress = this.syncQueue.filter(item => item.status === 'in_progress').length;
    this.syncStats.failed = this.syncQueue.filter(item => item.status === 'failed').length;
    this.syncStats.completed = this.syncQueue.filter(item => item.status === 'completed').length;
    this.notifyListeners();
  }

  // Notify all registered listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({...this.syncStats}));
  }

  // Subscribe to sync status updates
  public subscribe(callback: (stats: SyncStats) => void): () => void {
    this.listeners.add(callback);
    callback({...this.syncStats}); // Initial call with current stats
    return () => this.listeners.delete(callback);
  }

  // Process the sync queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    if (this.syncQueue.length === 0) {
      this.updateStats();
      return;
    }
    
    // Update stats
    this.syncStats.lastSyncAttempt = new Date().toISOString();
    this.notifyListeners();
    
    this.isProcessing = true;
    console.log(`Processing sync queue: ${this.syncQueue.length} items`);
    
    let processed = 0;
    
    try {
      // Process only pending items
      const pendingItems = this.syncQueue.filter(item => item.status === 'pending');
      
      for (const item of pendingItems) {
        try {
          // Mark as in progress
          item.status = 'in_progress';
          this.saveQueue();
          this.updateStats();
          
          // Process based on type
          if (item.type === 'recording') {
            console.log(`Processing recording upload: ${item.data.metadata.title}`);
            if (this.localOnly) {
              // Simulate successful upload in local-only mode
              console.log(`Local mode: Simulating successful upload for ${item.data.metadata.title}`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
            } else {
              await this.syncRecording(item);
            }
          } else if (item.type === 'delete') {
            console.log(`Processing deletion: ${item.data.type}`);
            if (this.localOnly) {
              // Simulate successful deletion in local-only mode
              console.log(`Local mode: Simulating successful deletion`);
              await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
            } else {
              await this.syncDeletion(item);
            }
          }
          
          // Mark as completed
          item.status = 'completed';
          processed++;
          
        } catch (error) {
          console.error(`Sync failed for item ${item.id}:`, error);
          
          // Increment retry count
          item.retryCount = (item.retryCount || 0) + 1;
          
          // Mark as failed if max retries exceeded
          if (item.retryCount >= 3) {
            item.status = 'failed';
            item.error = error instanceof Error ? error.message : 'Unknown error';
          } else {
            item.status = 'pending'; // Retry later
          }
        }
        
        // Save queue after each item
        this.saveQueue();
        this.updateStats();
      }
      
      if (processed > 0) {
        this.syncStats.lastSuccessfulSync = new Date().toISOString();
        console.log(`Successfully processed ${processed} sync items`);
      }
      
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isProcessing = false;
      this.updateStats();
    }
  }

  // Force an immediate sync attempt
  public async sync(): Promise<void> {
    return this.processQueue();
  }

  // Add a recording to the sync queue
  public async queueRecording(
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    videoBlob: Blob,
    thumbnailBlob: Blob,
    metadata: any
  ): Promise<string> {
    const recordingId = `rec-${Date.now()}`;
    
    const item: SyncItem = {
      id: recordingId,
      type: 'recording',
      performanceId,
      rehearsalId,
      data: {
        videoBlob,
        thumbnailBlob,
        metadata: {
          ...metadata,
          id: recordingId,
          status: 'pending_sync'
        },
        performanceTitle: performanceTitle
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    this.syncQueue.push(item);
    this.saveQueue();

    // If we're online, process the queue immediately
    if (navigator.onLine) {
      this.processQueue();
    }

    return recordingId;
  }

  // Add a metadata update to the sync queue
  public async queueMetadataUpdate(
    performanceId: string,
    rehearsalId: string,
    recordingId: string,
    metadata: Partial<Metadata>
  ): Promise<void> {
    const item: SyncItem = {
      id: `meta-${Date.now()}`,
      type: 'metadata',
      performanceId,
      rehearsalId,
      data: {
        recordingId,
        metadata
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    this.syncQueue.push(item);
    this.saveQueue();

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  // Add a deletion to the sync queue
  public async queueDeletion(
    performanceId: string,
    performanceTitle: string,
    rehearsalId: string,
    rehearsalTitle: string,
    recordingId?: string,
    recordingTitle?: string
  ): Promise<void> {
    const itemType = recordingId ? 'recording' : rehearsalId ? 'rehearsal' : 'performance';
    
    const item: SyncItem = {
      id: `del-${Date.now()}`,
      type: 'delete',
      performanceId,
      rehearsalId,
      data: {
        type: itemType,
        performanceTitle,
        rehearsalTitle,
        recordingId,
        recordingTitle
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    this.syncQueue.push(item);
    this.saveQueue();

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  // Get current sync status information
  public getStats(): SyncStats {
    return {...this.syncStats};
  }

  // Sync a recording to the server
  private async syncRecording(item: SyncItem): Promise<void> {
    if (this.localOnly) {
      console.log('Local-only mode: Simulating successful upload for:', item.data.metadata.title);
      return Promise.resolve();
    }

    const { videoBlob, thumbnailBlob, metadata, performanceTitle } = item.data;
    
    const formData = new FormData();
    formData.append('video', videoBlob, `${metadata.title}.mp4`);
    formData.append('thumbnail', thumbnailBlob, `${metadata.title}_thumb.jpg`);
    
    formData.append('performanceId', item.performanceId);
    formData.append('performanceTitle', performanceTitle);
    formData.append('rehearsalId', item.rehearsalId);
    formData.append('rehearsalTitle', metadata.rehearsalTitle || 'Rehearsal');
    formData.append('recordingTitle', metadata.title);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error('Upload failed');
    }
    
    return res.json();
  }

  // Sync metadata changes to the server
  private async syncMetadata(item: SyncItem): Promise<void> {
    // This would be implemented with a new API endpoint
    const res = await fetch('/api/update-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        performanceId: item.performanceId,
        rehearsalId: item.rehearsalId,
        recordingId: item.data.recordingId,
        metadata: item.data.metadata
      }),
    });
    
    if (!res.ok) {
      throw new Error('Metadata update failed');
    }
    
    return res.json();
  }

  // Sync deletion to the server
  private async syncDeletion(item: SyncItem): Promise<void> {
    const res = await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.data),
    });
    
    if (!res.ok) {
      throw new Error('Deletion failed');
    }
    
    return res.json();
  }
}

// Export a singleton instance
export const syncService = new SyncService();