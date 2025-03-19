import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { appInitialize } from '@/lib/firebase-admin';

// Initialize Firebase Admin once
const adminApp = appInitialize();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const sessionCookie = req.cookies.session || '';
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Verify session
    const decodedClaims = await getAuth().verifySessionCookie(sessionCookie, true);
    
    return res.status(200).json({ 
      uid: decodedClaims.uid,
      email: decodedClaims.email 
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session' });
  }
} 