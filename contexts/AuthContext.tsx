// contexts/AuthContext.tsx
// This replaces Clerk authentication with Firebase Auth

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isGoogleDriveConnected: boolean;
  setIsGoogleDriveConnected: (isConnected: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Check if user exists in Firestore
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          
          if (userDoc.exists()) {
            // User exists, check Google Drive connection
            setIsGoogleDriveConnected(userDoc.data().isGoogleDriveConnected || false);
          } else {
            // Create new user document
            await setDoc(doc(db, 'users', currentUser.uid), {
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              isGoogleDriveConnected: false,
              createdAt: new Date()
            });
            setIsGoogleDriveConnected(false);
          }
        } catch (err) {
          console.error('Error checking user data:', err);
        }
      }
      
      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Sign in with Google
  const login = async () => {
    setError(null);
    try {
      // Create provider with more comprehensive Drive scopes
      const provider = new GoogleAuthProvider();
      
      // Add scopes for Google Drive access
      provider.addScope('https://www.googleapis.com/auth/drive.file');          // Create/read/update/delete files the app created
      provider.addScope('https://www.googleapis.com/auth/drive.appdata');       // Application data folder (hidden from users)
      provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly'); // View file metadata
      
      // Sign in with popup
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during sign in');
    }
  };

  // Sign out
  const logout = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'An error occurred during sign out');
    }
  };

  // Get ID token for API calls
  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (err) {
      console.error('Error getting ID token:', err);
      return null;
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    isGoogleDriveConnected,
    setIsGoogleDriveConnected,
    login,
    logout,
    getIdToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 