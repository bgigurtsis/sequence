// contexts/AuthContext.tsx
// This replaces Clerk authentication with Firebase Auth

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  AuthErrorCodes
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isGoogleDriveConnected: boolean;
  setIsGoogleDriveConnected: (isConnected: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Check if user has Google Drive connected
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setIsGoogleDriveConnected(userDoc.data().isGoogleDriveConnected || false);
          } else {
            // Create user document if it doesn't exist
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
          console.error('Error checking Google Drive connection:', err);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code) {
        setError(err.message || 'An error occurred during sign in');
      } else {
        setError('An unknown error occurred during sign in');
      }
      console.error('Login error:', err);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      if (err.code) {
        setError(err.message || 'An error occurred during sign out');
      } else {
        setError('An unknown error occurred during sign out');
      }
      console.error('Logout error:', err);
    }
  };

  const value = {
    user,
    loading,
    error,
    isGoogleDriveConnected,
    setIsGoogleDriveConnected,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 