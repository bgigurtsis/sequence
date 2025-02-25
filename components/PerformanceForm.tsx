'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Performance } from '../types';
import { Info, X, Plus } from 'lucide-react';

interface PerformanceFormProps {
  onSave: (data: { title: string; defaultPerformers: string[] }) => void;
  onCancel: () => void;
  initialValues?: Partial<Performance>;
  onDelete?: () => void;
}

const PerformanceForm: React.FC<PerformanceFormProps> = ({
  onSave,
  onCancel,
  initialValues,
  onDelete
}) => {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [performers, setPerformers] = useState<string[]>(initialValues?.defaultPerformers || []);
  const [newPerformer, setNewPerformer] = useState('');
  
  // Add refs to maintain focus
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newPerformerInputRef = useRef<HTMLInputElement>(null);
  
  // Track which input had focus last
  const [lastFocused, setLastFocused] = useState<'title' | 'newPerformer' | null>(null);
  
  // Restore focus after render
  useEffect(() => {
    if (lastFocused === 'title' && titleInputRef.current) {
      titleInputRef.current.focus();
    } else if (lastFocused === 'newPerformer' && newPerformerInputRef.current) {
      newPerformerInputRef.current.focus();
    }
  }, [lastFocused, title, newPerformer]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      defaultPerformers: performers
    });
  };
  
  const addPerformer = () => {
    if (newPerformer.trim() && !performers.includes(newPerformer.trim())) {
      setPerformers([...performers, newPerformer.trim()]);
      setNewPerformer('');
      // Focus back on input after adding
      setTimeout(() => {
        if (newPerformerInputRef.current) {
          newPerformerInputRef.current.focus();
        }
      }, 0);
    }
  };
  
  const removePerformer = (performerToRemove: string) => {
    setPerformers(performers.filter(p => p !== performerToRemove));
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
      <FieldWithTooltip 
        label="Performance Title" 
        tooltip="Name of your production, show, or performance project"
      >
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setLastFocused('title')}
          className="w-full p-2 border rounded"
          placeholder="E.g., Hamlet 2023"
          required
        />
      </FieldWithTooltip>
      
      <FieldWithTooltip 
        label="Performers" 
        tooltip="Add cast members, musicians, or other performers who will appear in recordings"
      >
        <div className="space-y-3">
          <div className="flex">
            <input
              ref={newPerformerInputRef}
              type="text"
              value={newPerformer}
              onChange={(e) => setNewPerformer(e.target.value)}
              onFocus={() => setLastFocused('newPerformer')}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPerformer())}
              className="flex-1 p-2 border rounded-l"
              placeholder="Add performer name"
            />
            <button
              type="button"
              onClick={addPerformer}
              className="bg-blue-500 text-white px-3 rounded-r hover:bg-blue-600"
            >
              <Plus size={16} />
            </button>
          </div>
          
          {performers.length > 0 ? (
            <div className="border rounded p-2 max-h-40 overflow-y-auto">
              {performers.map(performer => (
                <div key={performer} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span>{performer}</span>
                  <button
                    type="button"
                    onClick={() => removePerformer(performer)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No performers added yet. Add performers to help organize your recordings.
            </p>
          )}
        </div>
      </FieldWithTooltip>
      
      <div className="flex space-x-3 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete Performance
          </button>
        )}
        <button
          type="submit"
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          {initialValues && initialValues.title ? 'Update Performance' : 'Create Performance'}
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

export default PerformanceForm;
