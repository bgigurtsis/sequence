import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { appInitialize, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

// Initialize Firebase Admin
appInitialize();

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get user ID and code from request
  const { userId, code } = req.body;
  
  if (!userId || !code) {
    return res.status(400).json({ error: 'User ID and authorization code are required' });
  }
  
  try {
    // Verify that the request is for a valid user
    await getAdminAuth().getUser(userId);
    
    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      return res.status(400).json({ 
        error: 'No refresh token returned. Make sure to set access_type=offline and prompt=consent' 
      });
    }
    
    // Store refresh token in Firestore
    await getAdminFirestore().collection('users').doc(userId).update({
      googleRefreshToken: tokens.refresh_token,
      googleTokenUpdatedAt: new Date().toISOString(),
      isGoogleDriveConnected: true
    });
    
    return res.status(200).json({ 
      success: true,
      message: 'Google Drive successfully connected'
    });
  } catch (error) {
    console.error('Error connecting Google Drive:', error);
    return res.status(500).json({ 
      error: 'Failed to connect Google Drive',
      details: error
    });
  }
} 