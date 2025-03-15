import { appInitialize } from './firebase-admin';

// For production, you should securely store this service account
const getServiceAccount = (): any => {
  // First try environment variable as JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.error('Error parsing Firebase service account JSON:', error);
    }
  }
  
  // Then try as a path to a file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      // In a real app, use fs to read this file
      return require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    } catch (error) {
      console.error('Error loading Firebase service account file:', error);
    }
  }
  
  // For local development, use application default credentials
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Using application default credentials for Firebase Admin SDK');
    return undefined;
  }
  
  throw new Error('Firebase service account configuration missing');
};

// Initialize the Admin SDK with the right credentials
export const initializeAdminSDK = () => {
  try {
    const serviceAccount = getServiceAccount();
    return appInitialize(serviceAccount);
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}; 