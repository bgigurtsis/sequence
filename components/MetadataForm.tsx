'use client';

import React, { useState } from 'react';
import PerformerChipsInput from './PerformerChipsInput';

interface MetadataFormProps {
  onSave: (metadata: {
    title: string;
    time: string;
    performers: string[];
    notes?: string;
    rehearsalId: string;
    tags: string[];
  }) => void;
  onCancel: () => void;
  rehearsals: { id: string; title: string }[];
  initialValues?: {
    title?: string;
    time?: string;
    performers?: string[];
    notes?: string;
    rehearsalId?: string;
    tags?: string[];
  };
  availablePerformers?: string[];
  onDelete?: () => void;
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  onSave,
  onCancel,
  rehearsals,
  initialValues = {},
  availablePerformers = [],
  onDelete,
}) => {
  const [title, setTitle] = useState(initialValues.title || '');
  const [time, setTime] = useState(initialValues.time || new Date().toTimeString().split(' ')[0]);
  const [performers, setPerformers] = useState<string[]>(initialValues.performers || []);
  const [notes, setNotes] = useState(initialValues.notes || '');
  const [rehearsalId, setRehearsalId] = useState(initialValues.rehearsalId || (rehearsals[0]?.id || ''));
  const [tags, setTags] = useState<string[]>(initialValues.tags || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      time,
      performers,
      notes,
      rehearsalId,
      tags,
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
        <label className="block text-sm font-medium">Performers</label>
        <PerformerChipsInput
          value={performers}
          onChange={setPerformers}
          placeholder="Select performers..."
        />
        {availablePerformers.length > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            Available: {availablePerformers.join(', ')}
          </div>
        )}
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
        <label className="block text-sm font-medium">Rehearsal</label>
        <select
          value={rehearsalId}
          onChange={(e) => setRehearsalId(e.target.value)}
          className="border p-2 rounded w-full"
          required
        >
          {rehearsals.map(rehearsal => (
            <option key={rehearsal.id} value={rehearsal.id}>{rehearsal.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Tags</label>
        <PerformerChipsInput
          value={tags}
          onChange={setTags}
          placeholder="Add a tag..."
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

export default MetadataForm;