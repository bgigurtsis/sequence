// lib/firebase-admin.ts
// This file initializes Firebase Admin SDK for server-side operations

import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export function appInitialize() {
  if (!admin.apps.length) {
    try {
      // Get the Base64 encoded service account key
      const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      // Check if it exists
      if (!serviceAccountBase64) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
      }
      
      // Decode the Base64 string and parse as JSON
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, 'base64').toString()
      );
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
    }
  }
  return admin;
}

// Admin SDK services getters
export function getAdminAuth() {
  if (!admin.apps.length) appInitialize();
  return getAuth();
}

export function getAdminFirestore() {
  if (!admin.apps.length) appInitialize();
  return getFirestore();
}

export function getAdminStorage() {
  if (!admin.apps.length) appInitialize();
  return getStorage();
}

export function initializeAdminSDK() {
  if (!admin.apps.length) {
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      
      if (!serviceAccountJson) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
      }
      
      // If your key is Base64 encoded
      const serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString());
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error('Firebase admin initialization error:', error);
    }
  }
  return admin;
} 