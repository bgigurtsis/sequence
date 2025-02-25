'use client';

import React, { useState } from 'react';
import { Collection } from '../types';
import { usePerformances } from '../contexts/PerformanceContext';
import { Plus, FolderOpen, Edit, Trash2, Video } from 'lucide-react';

const CollectionsView: React.FC = () => {
  const { collections, createCollection, deleteCollection, updateCollection } = usePerformances();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCollection({ title, description });
    setTitle('');
    setDescription('');
    setShowCreateForm(false);
  };
  
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCollection) {
      updateCollection(editingCollection.id, { title, description });
      setEditingCollection(null);
    }
    setTitle('');
    setDescription('');
  };
  
  const startEditing = (collection: Collection) => {
    setEditingCollection(collection);
    setTitle(collection.title);
    setDescription(collection.description || '');
  };
  
  // Empty state for no collections
  if (collections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-8 px-6 border border-dashed rounded-lg">
          <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Collections Yet</h3>
          <p className="text-gray-500 mb-6">
            Create collections to organize your recordings for easier access
          </p>
          
          {showCreateForm ? (
            <form onSubmit={handleCreateSubmit} className="max-w-md mx-auto text-left">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Collection Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="E.g., Best Performances"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="What kind of recordings will this collection contain?"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                >
                  Create Collection
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 inline-flex items-center"
            >
              <Plus size={16} className="mr-1" />
              Create Your First Collection
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Render collections list
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Collections</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 text-white py-1 px-3 rounded hover:bg-blue-600 text-sm flex items-center"
        >
          <Plus size={14} className="mr-1" />
          New Collection
        </button>
      </div>
      
      {/* Explanation of collections */}
      <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm">
        <p>
          <strong>Collections</strong> let you organize recordings across different performances and rehearsals,
          like creating playlists of your favorite or related recordings.
        </p>
      </div>
      
      {showCreateForm && (
        <div className="border rounded-md p-3 mb-4">
          <h3 className="font-medium mb-2">Create New Collection</h3>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 rounded w-full"
              placeholder="Collection title"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 rounded w-full"
              placeholder="What's this collection about?"
              rows={2}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button 
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateSubmit}
              className="px-3 py-1 bg-blue-500 text-white rounded"
              disabled={!title.trim()}
            >
              Create
            </button>
          </div>
        </div>
      )}
      
      {collections.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-dashed rounded-md">
          <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
          <p>No collections yet</p>
          <p className="text-sm mt-1">Create a collection to organize your recordings</p>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map(collection => (
            <div key={collection.id} className="border rounded p-3 hover:bg-gray-50 cursor-pointer">
              <h3 className="font-medium">{collection.title}</h3>
              {collection.description && (
                <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
              )}
              <div className="text-xs text-gray-500 mt-2">
                {collection.recordingIds?.length || 0} recordings
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionsView; 