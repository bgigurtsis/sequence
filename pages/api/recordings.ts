import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { getUserGoogleAuthClient } from '@/lib/googleAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get the current user
    const { userId } = auth();
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get Google Drive client for this user
    const oauth2Client = await getUserGoogleAuthClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // List audio/video files from Google Drive
    const response = await drive.files.list({
      q: "mimeType contains 'audio/' or mimeType contains 'video/'",
      fields: 'files(id, name, mimeType, createdTime, webContentLink)',
      orderBy: 'createdTime desc',
    });
    
    res.status(200).json({ recordings: response.data.files || [] });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
} 