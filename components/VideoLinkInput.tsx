'use client';

import React, { useState } from 'react';
import { Link as LinkIcon, ArrowLeft, Check } from 'lucide-react';

interface VideoLinkInputProps {
  onLinkSubmit: (url: string, title: string) => void;
  onCancel: () => void;
}

const VideoLinkInput: React.FC<VideoLinkInputProps> = ({ onLinkSubmit, onCancel }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      setError('Please enter a video URL');
      return;
    }

    if (!title) {
      setError('Please enter a title for this video');
      return;
    }

    try {
      setIsProcessing(true);

      // Validate URL (ensuring it starts with http/https)
      let validUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = 'https://' + url;
      }

      try {
        new URL(validUrl);
      } catch (e) {
        setError('Please enter a valid URL');
        setIsProcessing(false);
        return;
      }

      // Pass the validated URL to the parent
      onLinkSubmit(validUrl, title);
    } catch (error: unknown) {
      console.error('Error uploading video link:', error);
      setError((error as Error).message || 'Failed to upload video link');
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 max-w-lg w-full">
      <div className="flex items-center mb-4">
        <button
          onClick={onCancel}
          className="mr-2 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold">Add Video Link</h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for this video"
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Video URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/video"
            className="w-full p-2 border rounded"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Supported platforms: YouTube, Vimeo, Google Drive, Dropbox
          </p>
        </div>

        <div className="flex space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Add Link'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VideoLinkInput; 