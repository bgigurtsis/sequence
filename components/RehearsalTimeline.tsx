'use client';

import React from 'react';
import { Pencil, Calendar, Clock, Users } from 'lucide-react';

export interface Recording {
  id: string;
  title: string;
  time: string;
  performers: string[];
  notes?: string;
  videoBlob: Blob;
  thumbnailUrl: string;
  tags: string[];
}

export interface Section {
  id: string;
  title: string;
  location: string;
  date: string;
  recordings: Recording[];
}

export interface Performance {
  id: string;
  title: string;
  defaultPerformers: string[];
  sections: Section[];
}

interface RehearsalTimelineProps {
  performance: Performance;
  performances: Performance[];
  searchQuery: string;
  onSelectPerformance: (performanceId: string) => void;
  onWatchRecording: (sectionId: string, recording: Recording) => void;
  onEditRecording: (sectionId: string, recording: Recording) => void;
  onEditSection: (section: Section) => void;
  onNewSection: () => void;
  onEditPerformance: (performance: Performance) => void;
  onRecordSection: (sectionId: string) => void;
}

const RehearsalTimeline: React.FC<RehearsalTimelineProps> = ({
  performance,
  performances,
  searchQuery,
  onSelectPerformance,
  onWatchRecording,
  onEditRecording,
  onEditSection,
  onNewSection,
  onEditPerformance,
  onRecordSection,
}) => {
  // Function to check if a recording matches the search query.
  const matchesSearch = (recording: Recording, query: string) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      recording.title.toLowerCase().includes(q) ||
      recording.performers.join(' ').toLowerCase().includes(q) ||
      (recording.tags && recording.tags.join(' ').toLowerCase().includes(q))
    );
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Performance Selection */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <select
            value={performance.id}
            onChange={(e) => onSelectPerformance(e.target.value)}
            className="text-lg font-bold p-2 border rounded"
          >
            {performances.map((perf) => (
              <option key={perf.id} value={perf.id}>
                {perf.title}
              </option>
            ))}
          </select>
          <button onClick={() => onEditPerformance(performance)} className="text-blue-500">
            <Pencil size={16} />
          </button>
        </div>
        <button onClick={onNewSection} className="bg-green-500 text-white px-4 py-2 rounded">
          New Rehearsal
        </button>
      </div>

      {/* Sections */}
      {performance.sections.length === 0 ? (
        <div className="text-center text-gray-600">
          No rehearsals found. Create a new rehearsal.
        </div>
      ) : (
        performance.sections.map((section) => {
          const filteredRecordings = section.recordings.filter(r => matchesSearch(r, searchQuery));
          return (
            <div key={section.id} className="border rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar size={20} />
                  <span className="font-medium text-xl">{section.title}</span>
                  <span className="text-sm text-gray-500">
                    ({section.location} on {section.date})
                  </span>
                  <button onClick={() => onEditSection(section)} className="text-blue-500">
                    <Pencil size={16} />
                  </button>
                </div>
                <button
                  onClick={() => onRecordSection(section.id)}
                  className="bg-blue-500 text-white px-3 py-1 rounded shadow"
                >
                  Record
                </button>
              </div>
              {filteredRecordings.length === 0 ? (
                <div className="text-gray-500 italic">No recordings match your search in this rehearsal.</div>
              ) : (
                filteredRecordings.map((recording) => (
                  <div key={recording.id} className="border rounded-lg p-4 mb-2 hover:bg-gray-50">
                    <div className="flex">
                      <img
                        src={recording.thumbnailUrl}
                        alt="Thumbnail"
                        className="w-24 h-16 object-cover rounded mr-4"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-lg">{recording.title}</h4>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="mr-1" size={16} />
                          {recording.time}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="mr-1" size={16} />
                          {recording.performers.join(', ')}
                        </div>
                        {recording.tags && recording.tags.length > 0 && (
                          <div className="mt-1">
                            {recording.tags.map(tag => (
                              <span key={tag} className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded mr-1">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {recording.notes && (
                          <p className="text-sm text-gray-600 mt-2">Note: {recording.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => onEditRecording(section.id, recording)} className="text-blue-500">
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => onWatchRecording(section.id, recording)}
                          className="px-3 py-1 bg-blue-100 rounded-full text-sm"
                        >
                          Watch
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default RehearsalTimeline;
