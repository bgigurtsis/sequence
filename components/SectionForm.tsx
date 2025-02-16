'use client';

import React, { useState } from 'react';

function getTodayFormatted() {
  const today = new Date();
  const dd = today.getDate().toString().padStart(2, '0');
  const mm = (today.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

interface SectionFormProps {
  onSave: (section: { title: string; location: string; date: string }) => void;
  onCancel: () => void;
  initialData?: { title?: string; location?: string; date?: string };
  onDelete?: () => void;
}

const SectionForm: React.FC<SectionFormProps> = ({ onSave, onCancel, initialData = {}, onDelete }) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [location, setLocation] = useState(initialData.location || '');
  const [date, setDate] = useState(initialData.date || getTodayFormatted());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, location, date });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Rehearsal Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Date</label>
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="DD-MM-YYYY"
          required
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

export default SectionForm;
