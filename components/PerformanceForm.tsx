'use client';

import React, { useState } from 'react';

interface PerformanceFormProps {
  onSave: (performance: { id?: string; title: string; defaultPerformers: string[] }) => void;
  onCancel: () => void;
  initialData?: { title?: string; defaultPerformers?: string[] };
}

const PerformanceForm: React.FC<PerformanceFormProps> = ({ onSave, onCancel, initialData = {} }) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [defaultPerformers, setDefaultPerformers] = useState((initialData.defaultPerformers || []).join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      defaultPerformers: defaultPerformers.split(',').map(p => p.trim()).filter(Boolean),
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
        <label className="block text-sm font-medium">Default Performers (comma separated)</label>
        <input
          type="text"
          value={defaultPerformers}
          onChange={(e) => setDefaultPerformers(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </div>
      <div className="flex justify-end space-x-4">
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
