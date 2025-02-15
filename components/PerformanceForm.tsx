'use client';

import React, { useState } from 'react';
import PerformerChipsInput from './PerformerChipsInput';

interface PerformanceFormProps {
  onSave: (performance: { title: string; defaultPerformers: string[] }) => void;
  onCancel: () => void;
  initialData?: { title?: string; defaultPerformers?: string[] };
  onDelete?: () => void;
}

const PerformanceForm: React.FC<PerformanceFormProps> = ({ onSave, onCancel, initialData = {}, onDelete }) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [defaultPerformers, setDefaultPerformers] = useState<string[]>(initialData.defaultPerformers || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      defaultPerformers,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Performance Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Default Performers</label>
        <PerformerChipsInput
          value={defaultPerformers}
          onChange={setDefaultPerformers}
          placeholder="Add a performer..."
        />
      </div>
      <div className="flex justify-end space-x-4">
        {onDelete && (
          <button type="button" onClick={onDelete} className="px-4 py-2 bg-red-500 text-white rounded">
            Delete
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Save
        </button>
      </div>
    </form>
  );
};

export default PerformanceForm;
