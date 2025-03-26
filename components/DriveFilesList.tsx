'use client';

import { useState, useEffect } from 'react';
import { useGoogleDrive, GoogleDriveFile } from '../hooks/useGoogleDrive';

export default function DriveFilesList() {
  const [folderName, setFolderName] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderStack, setFolderStack] = useState<{id?: string, name: string}[]>([{ name: 'Root' }]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { 
    loading, 
    files, 
    fetchFiles, 
    createFolder, 
    deleteFile, 
    uploadFile 
  } = useGoogleDrive({
    onError: (error) => alert(`Error: ${error.message}`)
  });
  
  // Fetch files when component mounts
  useEffect(() => {
    fetchFiles();
  }, []);
  
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      alert('Please enter a folder name');
      return;
    }
    
    await createFolder(folderName, currentFolderId);
    setFolderName('');
  };
  
  const handleDeleteFile = async (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      await deleteFile(fileId, currentFolderId);
    }
  };
  
  const handleUploadFile = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }
    
    await uploadFile(selectedFile, currentFolderId);
    setSelectedFile(null);
  };
  
  const handleNavigateToFolder = (file: GoogleDriveFile) => {
    setFolderStack([...folderStack, { id: file.id, name: file.name }]);
    setCurrentFolderId(file.id);
    fetchFiles(file.id);
  };
  
  const handleNavigateBack = (index: number) => {
    const newStack = folderStack.slice(0, index + 1);
    const targetFolder = newStack[newStack.length - 1];
    
    setFolderStack(newStack);
    setCurrentFolderId(targetFolder.id);
    fetchFiles(targetFolder.id);
  };
  
  const isFolder = (file: GoogleDriveFile) => {
    return file.mimeType === 'application/vnd.google-apps.folder';
  };
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Google Drive Files</h1>
      
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 mb-4">
        {folderStack.map((folder, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && <span className="mx-1">/</span>}
            <button
              onClick={() => handleNavigateBack(index)}
              className="text-blue-500 hover:underline"
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>
      
      {/* Create Folder Form */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="New folder name"
          className="border p-2 rounded"
        />
        <button
          onClick={handleCreateFolder}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Create Folder
        </button>
      </div>
      
      {/* File Upload Form */}
      <div className="flex gap-2 mb-4">
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={handleUploadFile}
          disabled={loading || !selectedFile}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Upload File
        </button>
      </div>
      
      {/* Loading state */}
      {loading && <div className="my-4">Loading...</div>}
      
      {/* Files List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="border rounded p-4 hover:bg-gray-50"
          >
            {isFolder(file) ? (
              <div 
                className="cursor-pointer"
                onClick={() => handleNavigateToFolder(file)}
              >
                <div className="font-bold mb-2 text-blue-600">
                  📁 {file.name}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-bold mb-2">
                  {file.name}
                </div>
                {file.thumbnailLink && (
                  <img 
                    src={file.thumbnailLink} 
                    alt={file.name} 
                    className="w-full h-32 object-cover object-center mb-2"
                  />
                )}
                <div className="text-sm text-gray-600 mb-2">
                  {file.mimeType}
                </div>
                {file.webViewLink && (
                  <a 
                    href={file.webViewLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline block mb-2"
                  >
                    View in Google Drive
                  </a>
                )}
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        
        {files.length === 0 && !loading && (
          <div className="col-span-full text-center py-8 text-gray-500">
            No files found in this folder
          </div>
        )}
      </div>
    </div>
  );
} 