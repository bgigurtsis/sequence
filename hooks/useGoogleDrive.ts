import { useState } from 'react';
import { createDriveFolder, deleteDriveFile, listDriveFiles, getDriveFile } from '../app/actions/google-drive';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface UseGoogleDriveProps {
  onError?: (error: Error) => void;
}

export function useGoogleDrive({ onError }: UseGoogleDriveProps = {}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);

  const fetchFiles = async (folderId?: string) => {
    setLoading(true);
    try {
      const result = await listDriveFiles(folderId);
      if ('error' in result) {
        throw new Error(String(result.error));
      }
      setFiles(result.files || []);
      return result.files || [];
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
      console.error('[GOOGLE-DRIVE-HOOK-ERROR]', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async (name: string, parentId?: string): Promise<GoogleDriveFile | null> => {
    setLoading(true);
    try {
      const result = await createDriveFolder(name, parentId);
      if ('error' in result) {
        throw new Error(String(result.error));
      }
      await fetchFiles(parentId);
      return result.folder || null;
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
      console.error('[GOOGLE-DRIVE-HOOK-ERROR]', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string, parentId?: string): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await deleteDriveFile(fileId);
      if ('error' in result) {
        throw new Error(String(result.error));
      }
      await fetchFiles(parentId);
      return result.success || false;
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
      console.error('[GOOGLE-DRIVE-HOOK-ERROR]', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, folderId?: string): Promise<GoogleDriveFile | null> => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);
      
      if (folderId) {
        formData.append('folderId', folderId);
      }

      const response = await fetch('/api/upload/form', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const result = await response.json();
      await fetchFiles(folderId);
      return result.fileId ? {
        id: result.fileId,
        name: result.fileName,
        mimeType: file.type,
        webViewLink: result.webViewLink
      } : null;
    } catch (error) {
      if (error instanceof Error && onError) {
        onError(error);
      }
      console.error('[GOOGLE-DRIVE-HOOK-ERROR]', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    files,
    fetchFiles,
    createFolder,
    deleteFile,
    uploadFile,
  };
} 