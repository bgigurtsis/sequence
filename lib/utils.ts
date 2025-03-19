// First, define a TypeScript interface for Firestore Timestamp
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// Generate a unique ID with a given prefix
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatFirestoreTimestamp(timestamp: FirestoreTimestamp | Date | null | undefined): string {
  if (!timestamp) return '';
  
  if ('seconds' in timestamp) {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  
  return String(timestamp);
}

// For more specific formatting needs
export function formatFirestoreDate(timestamp: FirestoreTimestamp | Date | null | undefined): string {
  if (!timestamp) return '';
  
  if ('seconds' in timestamp) {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString();
  }
  
  return String(timestamp);
}

export function formatFirestoreTime(timestamp: FirestoreTimestamp | Date | null | undefined): string {
  if (!timestamp) return '';
  
  if ('seconds' in timestamp) {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toLocaleTimeString();
  }
  
  return String(timestamp);
} 