import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export class TokenService {
  private static STORAGE_KEY_PREFIX = 'google_token_';
  
  // Store Google refresh token
  static async storeToken(userId: string, token: string): Promise<void> {
    if (!userId || !token) {
      throw new Error('User ID and token are required');
    }
    
    try {
      // Store in Firestore
      await updateDoc(doc(db, 'users', userId), {
        googleRefreshToken: token,
        googleTokenUpdatedAt: new Date().toISOString(),
        isGoogleDriveConnected: true
      });
      
      // Also store in localStorage as backup
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${userId}`, token);
      }
      
      return;
    } catch (error) {
      console.error('Error storing token:', error);
      
      // Try localStorage if Firestore fails
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${this.STORAGE_KEY_PREFIX}${userId}`, token);
      } else {
        throw error;
      }
    }
  }
  
  // Get token from most secure available source
  static async getToken(userId: string): Promise<string | null> {
    if (!userId) return null;
    
    try {
      // Try Firestore first
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data().googleRefreshToken) {
        return userDoc.data().googleRefreshToken;
      }
      
      // Try localStorage as fallback
      if (typeof window !== 'undefined') {
        return localStorage.getItem(`${this.STORAGE_KEY_PREFIX}${userId}`);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting token:', error);
      
      // Try localStorage if Firestore fails
      if (typeof window !== 'undefined') {
        return localStorage.getItem(`${this.STORAGE_KEY_PREFIX}${userId}`);
      }
      
      return null;
    }
  }
  
  // Remove token (disconnect Google Drive)
  static async removeToken(userId: string): Promise<void> {
    try {
      // Remove from Firestore
      await updateDoc(doc(db, 'users', userId), {
        googleRefreshToken: null,
        isGoogleDriveConnected: false
      });
      
      // Remove from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`${this.STORAGE_KEY_PREFIX}${userId}`);
      }
    } catch (error) {
      console.error('Error removing token:', error);
      throw error;
    }
  }
} 