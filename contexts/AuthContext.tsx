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
      setLoading(true);
      
      // 1. Start Google OAuth flow
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/userinfo.email');
      provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
      
      // For Google Drive access (if needed)
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      // 2. Sign in with popup or redirect
      const result = await signInWithPopup(auth, provider);
      
      // 3. Get the ID token
      const idToken = await result.user.getIdToken();
      
      // 4. Send token to your backend to create a session cookie
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      // 5. Get user data and update state
      setUser(result.user);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
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