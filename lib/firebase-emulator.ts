import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { app } from './firebase';

export function connectToEmulators() {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    // Connect to Auth emulator
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://localhost:9099');

    // Connect to Firestore emulator
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, 'localhost', 8080);

    // Connect to Functions emulator
    const functions = getFunctions(app);
    connectFunctionsEmulator(functions, 'localhost', 5001);

    // Connect to Storage emulator
    const storage = getStorage(app);
    connectStorageEmulator(storage, 'localhost', 9199);

    console.log('Connected to Firebase emulators');
  }
} 