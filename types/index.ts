// Looking for Metadata type definition
// export type Metadata = {...}
// or 
// export interface Metadata {...} 

// Common type definitions

export interface Performance {
  id: string;
  title: string;
  defaultPerformers?: string[];
  rehearsals: Rehearsal[];
  createdAt: string;
}

export interface Rehearsal {
  id: string;
  title: string;
  performanceId: string;
  location?: string;
  date?: string;
  recordings: Recording[];
  createdAt: string;
}

export interface Recording {
  id: string;
  title: string;
  rehearsalId: string;
  date?: string;
  time?: string;
  performers?: string[];
  notes?: string;
  tags?: string[];
  thumbnailUrl?: string;
  sourceType?: 'recorded' | 'uploaded' | 'external';
  externalUrl?: string;
  createdAt: string;
}

export interface Metadata {
  title: string;
  time?: string;
  performers: string[];
  notes?: string;
  rehearsalId: string;
  tags: string[];
  sourceType?: 'recorded' | 'uploaded' | 'external';
  fileName?: string;
  externalUrl?: string;
  description?: string;
  date: string;
}

export interface PendingVideo {
  id: string;
  videoBlob: Blob;
  thumbnailBlob: Blob;
  metadata: Metadata;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  recordingIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Add these interfaces for service responses
export interface PerformanceResponse {
  id: string;
  title: string;
  createdAt: string;
}

export interface RehearsalResponse {
  id: string;
  title: string;
  performanceId: string;
  createdAt: string;
}

// Add other type definitions as needed 