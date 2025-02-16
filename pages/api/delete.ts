// pages/api/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

async function deleteFolder(drive: any, folderId: string) {
  console.log('Deleting folder:', folderId);
  
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
  });
  console.log('Files found in folder:', res.data.files?.length);

  if (res.data.files) {
    for (const file of res.data.files) {
      console.log('Processing file:', file.name, 'Type:', file.mimeType);
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        await deleteFolder(drive, file.id!);
      }
      console.log('Deleting file:', file.name, file.id);
      await drive.files.delete({ fileId: file.id! });
      console.log('File deleted successfully:', file.name);
    }
  }

  await drive.files.delete({ fileId: folderId });
  console.log('Folder deleted successfully:', folderId);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId, recordingTitle } = req.body;
    console.log('Delete request received:', { type, performanceId, performanceTitle, rehearsalId, rehearsalTitle, recordingId });

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    
    console.log('Attempting to get access token...');
    const tokenResponse = await oAuth2Client.getAccessToken();
    console.log('Access token obtained:', !!tokenResponse.token);

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    console.log('Looking for root StageVault folder...');
    const rootFolderRes = await drive.files.list({
      q: "name = 'StageVault Recordings' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
    });
    
    const rootFolderId = rootFolderRes.data.files?.[0]?.id;
    if (!rootFolderId) {
      console.log('Root folder not found!');
      return res.status(404).json({ error: 'Root folder not found' });
    }

    switch (type) {
      case 'performance': {
        console.log('Searching for performance folder:', performanceTitle);
        const perfFolderRes = await drive.files.list({
          q: `name = 'Performance_${performanceTitle}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
        });
        
        const perfFolderId = perfFolderRes.data.files?.[0]?.id;
        if (perfFolderId) {
          await deleteFolder(drive, perfFolderId);
        } else {
          console.log('Performance folder not found');
        }
        break;
      }
      
      case 'rehearsal': {
        if (!performanceTitle) {
          return res.status(400).json({ error: 'Performance title is required for rehearsal deletion' });
        }
        
        const perfFolderRes = await drive.files.list({
          q: `name = 'Performance_${performanceTitle}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
        });
        
        const perfFolderId = perfFolderRes.data.files?.[0]?.id;
        if (perfFolderId) {
          const rehFolderRes = await drive.files.list({
            q: `name = 'Rehearsal_${rehearsalTitle}' and '${perfFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
          });
          
          const rehFolderId = rehFolderRes.data.files?.[0]?.id;
          if (rehFolderId) {
            await deleteFolder(drive, rehFolderId);
          }
        }
        break;
      }

      case 'recording': {
        if (!performanceTitle || !rehearsalTitle || !recordingTitle) {
          return res.status(400).json({ error: 'All titles are required for recording deletion' });
        }
        
        const perfFolderRes = await drive.files.list({
          q: `name = 'Performance_${performanceTitle}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
        });
        
        const perfFolderId = perfFolderRes.data.files?.[0]?.id;
        if (perfFolderId) {
          const rehFolderRes = await drive.files.list({
            q: `name = 'Rehearsal_${rehearsalTitle}' and '${perfFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
          });
          
          const rehFolderId = rehFolderRes.data.files?.[0]?.id;
          if (rehFolderId) {
            const filesRes = await drive.files.list({
              q: `'${rehFolderId}' in parents and (name = '${recordingTitle}.mp4' or name = '${recordingTitle}_thumb.jpg') and trashed = false`,
              fields: 'files(id, name)',
            });
            
            if (filesRes.data.files) {
              for (const file of filesRes.data.files) {
                await drive.files.delete({ fileId: file.id! });
              }
            }
          }
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid deletion type' });
    }

    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Deletion failed', details: error?.message || 'Unknown error' });
  }
}