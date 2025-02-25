// components/TagsInput.tsx
'use client';

import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { X } from 'lucide-react';

interface TagsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

const TagsInput: React.FC<TagsInputProps> = ({ 
  tags, 
  onChange, 
  placeholder = 'Add tags...', 
  suggestions = [] 
}) => {
  const [input, setInput] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter suggestions based on input
  useEffect(() => {
    if (input.trim() === '') {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    const filtered = suggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(input.toLowerCase()) && 
        !tags.includes(suggestion)
      )
      .slice(0, 5); // Limit to 5 suggestions
    
    setFilteredSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setActiveSuggestion(0);
  }, [input, suggestions, tags]);
  
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };
  
  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || (e.key === ' ' && input.trim())) {
      e.preventDefault();
      if (showSuggestions && activeSuggestion >= 0 && activeSuggestion < filteredSuggestions.length) {
        addTag(filteredSuggestions[activeSuggestion]);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setActiveSuggestion(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setActiveSuggestion(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };
  
  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded min-h-[42px] bg-white">
        {tags.map((tag, index) => (
          <div 
            key={index} 
            className="flex items-center bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-sm"
          >
            <span>{tag}</span>
            <button 
              type="button"
              onClick={() => removeTag(index)}
              className="ml-1 text-blue-700 hover:text-blue-900"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input.trim()) setShowSuggestions(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 outline-none min-w-[120px] text-sm"
        />
      </div>
      
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg">
          <ul className="py-1 max-h-40 overflow-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={index}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  index === activeSuggestion ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => addTag(suggestion)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Display initial suggestions when input is empty */}
      {input === '' && suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Suggested tags:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 6).map((suggestion, index) => (
              !tags.includes(suggestion) && (
                <button
                  key={index}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-blue-50 hover:text-blue-700"
                >
                  {suggestion}
                </button>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsInput;