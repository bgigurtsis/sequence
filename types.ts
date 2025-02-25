// types.ts
export interface Recording {
    id: string;
    title: string;
    time: string;
    date: string;
    performers: string[];
    notes?: string;
    rehearsalId: string; // This is required and should be present
    videoUrl: string;
    thumbnailUrl: string;
    tags: string[];
    sourceType?: 'recorded' | 'uploaded' | 'external';
    localCopyAvailable?: boolean;
    createdAt?: string;
    syncStatus?: 'pending' | 'synced' | 'failed';
    performanceTitle?: string;
    rehearsalTitle?: string;
    isExternalLink?: boolean;
    externalUrl?: string;
    domain?: string;
  }
  
  
  export interface Rehearsal {
    id: string;
    title: string;
    location: string;
    date: string;
    recordings: Recording[];
    performanceId?: string;
    performanceTitle?: string;
  }
  
  export interface Performance {
    id: string;
    title: string;
    defaultPerformers: string[];
    rehearsals: Rehearsal[];
  }
  
  export interface Metadata {
    title: string;
    time: string;
    performers: string[];
    notes?: string;
    rehearsalId: string;
    tags: string[];
    fileName?: string;
    sourceType?: 'recorded' | 'uploaded' | 'external';
    externalUrl?: string;
    domain?: string;
  }
  
  export interface PendingVideo {
    videoBlob: Blob;
    thumbnail: string | Blob; // Update to accept either string or Blob
  }
  
  
  export interface VideoStorageItem {
    id: string;
    videoBlob: Blob;
    thumbnailBlob: Blob;
    metadata: {
      title: string;
      performanceId: string;
      rehearsalId: string;
      createdAt: string;
      performers: string[];
      tags: string[];
    };
  }

  export interface Collection {
    id: string;
    title: string;
    description?: string;
    recordingIds: string[];
    createdAt: string;
    updatedAt: string;
  }