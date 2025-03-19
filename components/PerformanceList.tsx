// Import the interface and/or the formatting function from utils
import { formatFirestoreTimestamp } from '@/lib/utils';

// First, find where your actual Performance type is defined
// If it's imported from another file, you'll need to modify that file instead
// For example, it might be from '@/types' or a similar location

// If you CAN'T modify the original Performance interface:
// 1. You need to use a different name for your local interface
interface PerformanceWithTimestamp {
  id: string;
  name: string;
  createdAt?: FirestoreTimestamp | Date;
  // Other properties...
}

// 2. Type cast your performances to use the extended interface
// Assuming 'performance' is your variable
<div>{(performance as unknown as PerformanceWithTimestamp)?.createdAt 
  ? formatTimestamp((performance as unknown as PerformanceWithTimestamp).createdAt) 
  : 'N/A'}</div>

// OR a cleaner approach - map your data to include the timestamp
// In your component where you process the data:
const performancesWithTimestamps = performances.map(perf => ({
  ...perf,
  // If needed, convert server timestamp to the right format
}) as PerformanceWithTimestamp);

// If you need to define it locally:
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// Update your Performance interface to include createdAt
interface Performance {
  id: string;
  name: string;
  // Add the createdAt property
  createdAt?: FirestoreTimestamp | Date;
  // Other properties...
}

// Add this helper function to your component or utilities
function formatTimestamp(timestamp: FirestoreTimestamp | Date | null | undefined): string {
  if (!timestamp) return '';
  
  // If it's a Firestore Timestamp object
  if (timestamp && 'seconds' in timestamp) {
    // Convert to JavaScript Date
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  
  return String(timestamp);
}

// Then use it in your render
<div>{performance?.createdAt ? formatTimestamp(performance.createdAt as any) : 'N/A'}</div> 