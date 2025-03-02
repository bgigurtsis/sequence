// Looking for Metadata type definition
// export type Metadata = {...}
// or 
// export interface Metadata {...} 

// Common type definitions

export interface Performance {
  id: string;
  title: string;
  defaultPerformers: string[];
  rehearsals: Rehearsal[];
}

export interface Rehearsal {
  id: string;
  title: string;
  location: string;
  date: string;
  recordings: Recording[];
}

export interface Recording {
  id: string;
  title: string;
  date: string;
  time?: string;
  videoUrl: string;
  thumbnailUrl: string;
  performers: string[];
  notes?: string;
  rehearsalId: string;
  tags: string[];
  isExternalLink?: boolean;
  externalUrl?: string;
  sourceType?: 'recorded' | 'uploaded' | 'external';
  domain?: string;
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

// Add other type definitions as needed 