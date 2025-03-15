import { NextApiRequest, NextApiResponse } from 'next';
import { appInitialize, getAdminAuth } from '@/lib/firebase-admin';

// Initialize Firebase Admin
appInitialize();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST for login, GET for session check
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET: Check current session
  if (req.method === 'GET') {
    const sessionCookie = req.cookies.session;
    
    if (!sessionCookie) {
      return res.status(401).json({ authenticated: false });
    }
    
    try {
      const decodedClaim = await getAdminAuth().verifySessionCookie(sessionCookie);
      return res.status(200).json({ 
        authenticated: true,
        uid: decodedClaim.uid,
        email: decodedClaim.email
      });
    } catch (error) {
      return res.status(401).json({ authenticated: false, error: 'Invalid session' });
    }
  }

  // POST: Create new session
  if (req.method === 'POST') {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }
    
    try {
      // Create session cookie (2 weeks expiration)
      const expiresIn = 60 * 60 * 24 * 14 * 1000;
      const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });
      
      // Set cookie options
      const options = {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };
      
      // Set the cookie
      res.setHeader('Set-Cookie', `session=${sessionCookie}; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Session creation error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
} 