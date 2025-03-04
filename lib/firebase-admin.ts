// lib/firebase-admin.ts
// This file initializes Firebase Admin SDK for server-side operations

import { initializeApp, getApps, cert } from 'firebase-admin/app';

export function appInitialize() {
  if (getApps().length === 0) {
    // Check for environment variable with service account
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;
      
    initializeApp({
      credential: serviceAccount 
        ? cert(serviceAccount) 
        : undefined,
    });
  }
} 