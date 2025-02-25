// components/SearchBar.tsx
'use client';

import React, { useState } from 'react';
import { Search, Calendar, X, Info } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string, dateRange: [string, string] | null) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const handleSearch = () => {
    const dateRange = startDate && endDate ? [startDate, endDate] as [string, string] : null;
    onSearch(query, dateRange);
  };
  
  const clearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    onSearch('', null);
  };
  
  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 border rounded-md overflow-hidden">
        <div className="flex-1 flex items-center relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          
          <input
            type="text"
            placeholder="Search performances, rehearsals and recordings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            aria-label="Search"
          />
          
          {/* Help tooltip */}
          <div className="absolute inset-y-0 right-3 flex items-center">
            <div className="relative group">
              <div className="absolute z-10 w-64 p-2 bg-black text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bottom-full right-0 mb-2 pointer-events-none">
                Search for performances by title, rehearsals by date or location, and recordings by title, performers, or tags.
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`p-2 flex items-center gap-1 text-sm ${
            showDateFilter ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
          title="Date filter"
        >
          <Calendar size={16} />
          <span className="hidden md:inline">Date Filter</span>
        </button>
        
        {(query || startDate || endDate) && (
          <button
            onClick={clearFilters}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title="Clear filters"
          >
            <X size={16} />
          </button>
        )}
        
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white py-2 px-4 hover:bg-blue-600"
        >
          Search
        </button>
      </div>
      
      {/* Date filter panel */}
      {showDateFilter && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white shadow-lg rounded-lg p-4 z-10 border">
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 mb-3">
            <div className="flex items-start">
              <Info size={12} className="mt-0.5 mr-1 flex-shrink-0" />
              <p>
                Filter recordings by date range. This will show all recordings created between the selected dates.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowDateFilter(false);
                handleSearch();
              }}
              className="bg-blue-500 text-white py-1 px-3 rounded hover:bg-blue-600"
            >
              Apply Date Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;