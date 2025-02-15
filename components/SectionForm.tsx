'use client';

import React, { useState } from 'react';

interface SectionFormProps {
  onSave: (section: { id?: string; title: string }) => void;
  onCancel: () => void;
  initialData?: { title?: string };
}

const SectionForm: React.FC<SectionFormProps> = ({ onSave, onCancel, initialData = {} }) => {
  const [title, setTitle] = useState(initialData.title || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Section Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
          required
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

export default SectionForm;
