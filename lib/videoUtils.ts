// lib/videoUtils.ts

export interface Recording {
    id: string;
    title: string;
    date: string;
    time: string;
    performers: string[];
    notes?: string;
    videoBlob: Blob;
    thumbnailUrl: string;
  }
  
  const DB_NAME = 'DanceRehearsalDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'recordings';
  
  function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  export async function addRecording(recording: Recording): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(recording);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
  
  export async function getRecordings(): Promise<Recording[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  