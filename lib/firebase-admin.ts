// lib/firebase-admin.ts
// This file initializes Firebase Admin SDK for server-side operations

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let adminApp: App;

export function appInitialize(serviceAccount?: any) {
  if (getApps().length === 0) {
    // Use provided service account or try to get from environment
    const credentials = serviceAccount || 
      (process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
        : undefined);
    
    adminApp = initializeApp({
      credential: credentials 
        ? cert(credentials) 
        : undefined,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    
    console.log('Firebase Admin initialized');
  } else {
    adminApp = getApps()[0];
  }
  
  return adminApp;
}

// Admin SDK services getters
export function getAdminAuth() {
  if (!adminApp) appInitialize();
  return getAuth();
}

export function getAdminFirestore() {
  if (!adminApp) appInitialize();
  return getFirestore();
}

export function getAdminStorage() {
  if (!adminApp) appInitialize();
  return getStorage();
} 