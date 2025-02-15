'use client';

import React, { useState } from 'react';

interface MetadataFormProps {
  onSave: (metadata: {
    title: string;
    date: string;
    time: string;
    performers: string[];
    notes?: string;
    sectionId: string;
  }) => void;
  onCancel: () => void;
  sections: { id: string; title: string }[];
  initialValues?: {
    title?: string;
    date?: string;
    time?: string;
    performers?: string;
    notes?: string;
    sectionId?: string;
  };
}

const MetadataForm: React.FC<MetadataFormProps> = ({ onSave, onCancel, sections, initialValues = {} }) => {
  const [title, setTitle] = useState(initialValues.title || '');
  const [date, setDate] = useState(initialValues.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialValues.time || new Date().toTimeString().split(' ')[0]);
  const [performers, setPerformers] = useState(initialValues.performers || '');
  const [notes, setNotes] = useState(initialValues.notes || '');
  const [sectionId, setSectionId] = useState(initialValues.sectionId || (sections[0]?.id || ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      date,
      time,
      performers: performers.split(',').map(p => p.trim()),
      notes,
      sectionId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Performers (comma separated)</label>
        <input
          type="text"
          value={performers}
          onChange={(e) => setPerformers(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border p-2 rounded w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Section</label>
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          className="border p-2 rounded w-full"
          required
        >
          {sections.map(section => (
            <option key={section.id} value={section.id}>{section.title}</option>
          ))}
        </select>
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

export default MetadataForm;
