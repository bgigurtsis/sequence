'use client';

import { useEffect } from 'react';
import { app } from '@/lib/firebase';

// Ensure Firebase is initialized on app startup
export function FirebaseInitializer() {
  useEffect(() => {
    // Force Firebase initialization
    if (app) {
      console.log('Firebase initialized');
    }
  }, []);
  
  return null;
} 