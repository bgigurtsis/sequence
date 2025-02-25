'use client';

import React from 'react';
import { X, Edit, Tag, Users, Clock, Calendar, MapPin } from 'lucide-react';
import { Recording } from '../types';

interface RecordingDetailsModalProps {
  recording: Recording;
  onClose: () => void;
  onEdit: () => void;
}

const RecordingDetailsModal: React.FC<RecordingDetailsModalProps> = ({ 
  recording, 
  onClose,
  onEdit
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{recording.title}</h2>
          <div className="flex space-x-2">
            <button
              onClick={onEdit}
              className="text-blue-500 hover:text-blue-700"
              title="Edit recording"
            >
              <Edit size={20} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Thumbnail */}
        <div className="mb-6">
          <img 
            src={recording.thumbnailUrl} 
            alt={recording.title} 
            className="w-full rounded-lg h-48 object-cover"
          />
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="flex items-center text-gray-700">
            <Clock size={18} className="mr-2" />
            <span className="font-medium mr-2">Time:</span> {recording.time}
          </div>
          
          <div className="flex items-center text-gray-700">
            <Calendar size={18} className="mr-2" />
            <span className="font-medium mr-2">Date:</span> 
            {new Date(recording.date).toLocaleDateString()}
          </div>
          
          <div className="flex items-center text-gray-700">
            <MapPin size={18} className="mr-2" />
            <span className="font-medium mr-2">Performance:</span> {recording.performanceTitle}
            <span className="mx-2">|</span>
            <span className="font-medium mr-2">Rehearsal:</span> {recording.rehearsalTitle}
          </div>

          {recording.performers.length > 0 && (
            <div className="text-gray-700">
              <div className="flex items-center mb-2">
                <Users size={18} className="mr-2" />
                <span className="font-medium">Performers:</span>
              </div>
              <div className="flex flex-wrap gap-2 ml-6">
                {recording.performers.map((performer, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                    {performer}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recording.tags.length > 0 && (
            <div className="text-gray-700">
              <div className="flex items-center mb-2">
                <Tag size={18} className="mr-2" />
                <span className="font-medium">Tags:</span>
              </div>
              <div className="flex flex-wrap gap-2 ml-6">
                {recording.tags.map((tag, index) => (
                  <span key={index} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recording.notes && (
            <div className="text-gray-700">
              <div className="font-medium mb-2">Notes:</div>
              <div className="bg-gray-50 p-3 rounded">
                {recording.notes}
              </div>
            </div>
          )}
          
          {recording.isExternalLink && recording.externalUrl && (
            <div className="text-gray-700">
              <div className="font-medium mb-2">External Link:</div>
              <a 
                href={recording.externalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                {recording.externalUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingDetailsModal; 