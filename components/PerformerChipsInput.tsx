'use client';

import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';

interface PerformerChipsInputProps {
  value: string[];
  onChange: (newValue: string[]) => void;
  placeholder?: string;
}

const PerformerChipsInput: React.FC<PerformerChipsInputProps> = ({ value, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus after state changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [value]);

  const addChip = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
    // Make sure to focus back after adding
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      addChip();
    }
  };

  const removeChip = (chip: string) => {
    onChange(value.filter(v => v !== chip));
    // Reset focus after removal
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  return (
    <div className="flex flex-wrap gap-2 border p-2 rounded">
      {value.map(chip => (
        <div key={chip} className="bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center">
          {chip}
          <button 
            type="button" 
            onClick={() => removeChip(chip)} 
            className="ml-1 text-red-500"
          >
            &times;
          </button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 outline-none"
      />
    </div>
  );
};

export default PerformerChipsInput;
