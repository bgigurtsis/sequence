import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req: NextApiRequest): Promise<{ fields: any; files: any }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

// Updated function: added isImage parameter.
async function uploadFileToDrive(
  auth: any,
  filePath: string,
  fileName: string,
  mimeType: string,
  folderId: string,
  isImage: boolean = false
): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });
  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };
  const media = {
    mimeType,
    body: fs.createReadStream(filePath),
  };
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id',
  });
  const fileId = response.data.id;
  await drive.permissions.create({
    fileId: fileId!,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  // For images, return a direct link; for videos, return the preview URL.
  if (isImage) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } else {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

async function getOrCreateFolder(auth: any, folderName: string, parentFolderId?: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });
  const queryParts = [
    `name = '${folderName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];
  if (parentFolderId) {
    queryParts.push(`'${parentFolderId}' in parents`);
  }
  const query = queryParts.join(' and ');
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  } else {
    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }
    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return file.data.id!;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { fields, files } = await parseForm(req);
    const performanceId = fields.performanceId;
    const performanceTitle = fields.performanceTitle || performanceId;
    const rehearsalId = fields.rehearsalId;
    const rehearsalTitle = fields.rehearsalTitle || rehearsalId;
    const recordingTitle = fields.recordingTitle || 'recording';

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    await oAuth2Client.getAccessToken();

    const rootFolderId = await getOrCreateFolder(oAuth2Client, 'StageVault Recordings');
    const performanceFolderId = await getOrCreateFolder(oAuth2Client, `Performance_${performanceTitle}`, rootFolderId);
    const rehearsalFolderId = await getOrCreateFolder(oAuth2Client, `Rehearsal_${rehearsalTitle}`, performanceFolderId);

    const videoFile = files.video;
    const thumbnailFile = files.thumbnail;
    const videoFileObj = Array.isArray(videoFile) ? videoFile[0] : videoFile;
    const thumbnailFileObj = Array.isArray(thumbnailFile) ? thumbnailFile[0] : thumbnailFile;

    const videoUrl = await uploadFileToDrive(
      oAuth2Client,
      videoFileObj.filepath,
      `${recordingTitle}.mp4`,
      videoFileObj.mimetype || 'video/mp4',
      rehearsalFolderId,
      false
    );
    const thumbnailUrl = await uploadFileToDrive(
      oAuth2Client,
      thumbnailFileObj.filepath,
      `${recordingTitle}_thumb.jpg`,
      thumbnailFileObj.mimetype || 'image/jpeg',
      rehearsalFolderId,
      true
    );

    res.status(200).json({ videoUrl, thumbnailUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
}
