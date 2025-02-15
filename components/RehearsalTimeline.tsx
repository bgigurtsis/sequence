'use client';

import React from 'react';
import { Pencil, Video, Users, Calendar, Clock } from 'lucide-react';

export interface Recording {
  id: string;
  title: string;
  date: string;
  time: string;
  performers: string[];
  notes?: string;
  videoBlob: Blob;
  thumbnailUrl: string;
}

export interface Section {
  id: string;
  title: string;
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
  onSelectPerformance: (performanceId: string) => void;
  onWatchRecording: (sectionId: string, recording: Recording) => void;
  onEditRecording: (sectionId: string, recording: Recording) => void;
  onEditSection: (section: Section) => void;
  onNewSection: () => void;
  onEditPerformance: (performance: Performance) => void;
}

const RehearsalTimeline: React.FC<RehearsalTimelineProps> = ({
  performance,
  performances,
  onSelectPerformance,
  onWatchRecording,
  onEditRecording,
  onEditSection,
  onNewSection,
  onEditPerformance,
}) => {
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
              <option key={perf.id} value={perf.id}>{perf.title}</option>
            ))}
          </select>
          <button onClick={() => onEditPerformance(performance)} className="text-blue-500">
            <Pencil size={16} />
          </button>
        </div>
        <button onClick={onNewSection} className="bg-green-500 text-white px-4 py-2 rounded">
          New Section
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {performance.sections.map((section) => (
          <div key={section.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Calendar size={20} />
                <span className="font-medium">{section.title}</span>
                <button onClick={() => onEditSection(section)} className="text-blue-500">
                  <Pencil size={16} />
                </button>
              </div>
            </div>
            {section.recordings.map((recording) => (
              <div key={recording.id} className="border rounded-lg p-4 mb-2 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{recording.title}</h4>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="mr-1" size={16} />
                      {recording.time}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="mr-1" size={16} />
                      {recording.performers.join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => onEditRecording(section.id, recording)} className="text-blue-500">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => onWatchRecording(section.id, recording)} className="px-3 py-1 bg-blue-100 rounded-full text-sm">
                      Watch
                    </button>
                  </div>
                </div>
                {recording.notes && (
                  <p className="text-sm text-gray-600 mt-2">Note: {recording.notes}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RehearsalTimeline;
