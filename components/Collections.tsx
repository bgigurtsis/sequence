'use client';

import React from 'react';
import { Collection } from '../types';
import { usePerformances } from '../contexts/PerformanceContext';

const Collections: React.FC = () => {
  const { collections } = usePerformances();
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">Collections</h2>
      
      {collections.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No collections yet</p>
      ) : (
        <div className="space-y-4">
          {collections.map(collection => (
            <div key={collection.id} className="border rounded p-3">
              <h3 className="font-medium">{collection.title}</h3>
              {collection.description && (
                <p className="text-sm text-gray-600">{collection.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Collections;
