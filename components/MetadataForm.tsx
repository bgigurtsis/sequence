'use client';

import React, { useRef, useState } from 'react';
import PerformerChipsInput from './PerformerChipsInput';
import TagsInput from './TagsInput';
import { Info } from 'lucide-react';
import { Metadata } from '../types';

interface MetadataFormProps {
  onSave: (metadata: Metadata) => void;
  onCancel: () => void;
  rehearsals: { id: string; title: string }[];
  initialValues?: Partial<Metadata>;
  availablePerformers?: string[];
  onDelete?: () => void;
  isEditing?: boolean;
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  onSave,
  onCancel,
  rehearsals,
  initialValues = {},
  availablePerformers = [],
  onDelete,
  isEditing = false
}) => {
  // Use REFS for form input values instead of state
  const rehearsalIdRef = useRef<HTMLSelectElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // These still need to be state since they're more complex
  const [performers, setPerformers] = useState(initialValues.performers || []);
  const [tags, setTags] = useState(initialValues.tags || []);
  
  // Set initial values
  React.useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.value = initialValues.title || '';
    }
    if (timeInputRef.current) {
      timeInputRef.current.value = initialValues.time || '';
    }
    if (notesTextareaRef.current) {
      notesTextareaRef.current.value = initialValues.notes || '';
    }
    if (rehearsalIdRef.current) {
      rehearsalIdRef.current.value = initialValues.rehearsalId 
        ? rehearsals.find(p => p.id === initialValues.rehearsalId)?.id || ''
        : rehearsals[0]?.id || '';
    }
  }, [initialValues, rehearsals]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get current values from refs
    const title = titleInputRef.current?.value || '';
    const time = timeInputRef.current?.value || '';
    const notes = notesTextareaRef.current?.value || '';
    const rehearsalId = rehearsalIdRef.current?.value || '';
    
    onSave({
      title,
      time,
      performers,
      notes,
      rehearsalId,
      tags,
      sourceType: initialValues.sourceType,
      fileName: initialValues.fileName
    });
  };
  
  // Helper component for form field with tooltip
  const FieldWithTooltip = ({ 
    label, 
    tooltip, 
    children 
  }: { 
    label: string, 
    tooltip: string, 
    children: React.ReactNode 
  }) => (
    <div className="mb-4">
      <div className="flex items-center mb-1">
        <label className="block text-sm font-medium">{label}</label>
        <div className="relative ml-2 group">
          <Info size={14} className="text-gray-400 cursor-help" />
          <div className="absolute z-10 w-64 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 transform -translate-x-1/2 mb-1 pointer-events-none">
            {tooltip}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rehearsal Selector */}
      <FieldWithTooltip 
        label="Rehearsal" 
        tooltip="Select which rehearsal this recording belongs to"
      >
        <select
          ref={rehearsalIdRef}
          defaultValue={initialValues.rehearsalId || ''}
          className="w-full p-2 border rounded"
          required
        >
          <option value="" disabled>Select a rehearsal</option>
          {rehearsals.map(rehearsal => (
            <option key={rehearsal.id} value={rehearsal.id}>
              {rehearsal.title}
            </option>
          ))}
        </select>
      </FieldWithTooltip>
      
      {/* Title - Using uncontrolled input with defaultValue */}
      <FieldWithTooltip 
        label="Recording Title" 
        tooltip="Give your recording a descriptive title to help identify it"
      >
        <input
          ref={titleInputRef}
          type="text"
          defaultValue={initialValues.title || ''}
          className="w-full p-2 border rounded"
          placeholder="E.g., Act 1 Run-through"
          required
        />
      </FieldWithTooltip>
      
      {/* Time - Using uncontrolled input with defaultValue */}
      <FieldWithTooltip 
        label="Time" 
        tooltip="Track when this was recorded (e.g., 'Morning', '2:30pm')"
      >
        <input
          ref={timeInputRef}
          type="text"
          defaultValue={initialValues.time || ''}
          className="w-full p-2 border rounded"
          placeholder="E.g., Morning, Afternoon, 2:30pm"
        />
      </FieldWithTooltip>
      
      {/* Performers */}
      <FieldWithTooltip 
        label="Performers" 
        tooltip="Add specific performers who appear in this recording"
      >
        <PerformerChipsInput
          value={performers}
          onChange={setPerformers}
          placeholder="Add performers..."
        />
        {availablePerformers.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {availablePerformers.map((performer, idx) => (
              !performers.includes(performer) && (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPerformers([...performers, performer])}
                  className="text-xs bg-gray-100 hover:bg-blue-50 px-2 py-1 rounded-full text-gray-700 hover:text-blue-700"
                >
                  {performer}
                </button>
              )
            ))}
          </div>
        )}
      </FieldWithTooltip>
      
      {/* Tags */}
      <FieldWithTooltip 
        label="Tags" 
        tooltip="Add tags to help organize and find recordings"
      >
        <TagsInput
          tags={tags}
          onChange={setTags}
          placeholder="Add tags..."
          suggestions={["blocking", "monologue", "costume", "tech", "lighting", "vocal", "dance", "music", "props"]}
        />
        <p className="text-xs text-gray-500 mt-1">
          Type a tag and press Enter to add it
        </p>
      </FieldWithTooltip>
      
      {/* Notes - Using uncontrolled textarea with defaultValue */}
      <FieldWithTooltip 
        label="Notes" 
        tooltip="Add any additional context or observations about this recording"
      >
        <textarea
          ref={notesTextareaRef}
          className="w-full p-2 border rounded"
          rows={3}
          defaultValue={initialValues.notes || ''}
          placeholder="E.g., First full run with costumes. Good pacing in Act 2."
        />
      </FieldWithTooltip>
      
      {/* Add this to the component to show the source type if available */}
      {initialValues?.sourceType && (
        <div className="mb-4 p-2 bg-gray-50 rounded-md text-sm">
          <span className="font-medium">Source: </span>
          {initialValues.sourceType === 'uploaded' ? 'Uploaded file' : 
           initialValues.sourceType === 'recorded' ? 'Recorded video' : 
           'External link'}
        </div>
      )}
      
      {/* If there's a file name available, display it */}
      {initialValues?.fileName && (
        <div className="mb-4 p-2 bg-blue-50 rounded-md text-sm">
          <span className="font-medium">File: </span>
          {initialValues.fileName}
        </div>
      )}
      
      <div className="flex space-x-3 pt-2">
        {onDelete && (
          <button type="button" onClick={onDelete} className="px-4 py-2 bg-red-500 text-white rounded">
            Delete
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          {isEditing ? 'Update Recording' : 'Save Recording'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default MetadataForm;