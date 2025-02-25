// components/RehearsalTimeline.tsx
'use client';

import React, { useMemo } from 'react';
import { usePerformances } from '../contexts/PerformanceContext';
import { Rehearsal, Performance, Recording } from '../types';
import { Camera, Clock, MapPin, Play, Edit, Info } from 'lucide-react';

interface RehearsalTimelineProps {
  performance?: Performance;
  performances?: Performance[];
  searchQuery?: string;
  onSelectPerformance?: (id: string) => void;
  onWatchRecording?: (rehearsalId: string, recording: Recording) => void;
  onEditRecording?: (rehearsalId: string, recording: Recording) => void;
  onEditRehearsal?: (rehearsal: Rehearsal) => void; 
  onNewRehearsal?: (performanceId: string) => void;
  onEditPerformance?: (performance: Performance) => void;
  onRecordRehearsal?: (rehearsalId: string) => void;
}

const RehearsalTimeline: React.FC<RehearsalTimelineProps> = ({
  performance,
  performances = [],
  searchQuery = '',
  onSelectPerformance,
  onWatchRecording,
  onEditRecording,
  onEditRehearsal,
  onNewRehearsal,
  onEditPerformance,
  onRecordRehearsal
}) => {
  const { performances: contextPerformances } = usePerformances();

  // Get all rehearsals and sort by date
  const sortedRehearsals = useMemo(() => {
    const allRehearsals: (Rehearsal & { performanceTitle: string })[] = [];
    
    contextPerformances.forEach(performance => {
      performance.rehearsals.forEach(rehearsal => {
        allRehearsals.push({
          ...rehearsal,
          performanceTitle: performance.title
        });
      });
    });
    
    // Convert date format from DD-MM-YYYY to YYYY-MM-DD for proper sorting
    return allRehearsals.sort((a, b) => {
      const aDateParts = a.date.split('-');
      const bDateParts = b.date.split('-');
      
      const aDate = new Date(`${aDateParts[2]}-${aDateParts[1]}-${aDateParts[0]}`);
      const bDate = new Date(`${bDateParts[2]}-${bDateParts[1]}-${bDateParts[0]}`);
      
      return bDate.getTime() - aDate.getTime(); // Newest first
    });
  }, [contextPerformances]);
  
  // Group rehearsals by month
  const rehearsalsByMonth = useMemo(() => {
    const result: { [key: string]: (Rehearsal & { performanceTitle: string })[] } = {};
    
    sortedRehearsals.forEach(rehearsal => {
      const dateParts = rehearsal.date.split('-');
      const year = dateParts[2];
      const month = dateParts[1];
      const monthYear = `${year}-${month}`;
      
      if (!result[monthYear]) {
        result[monthYear] = [];
      }
      
      result[monthYear].push(rehearsal);
    });
    
    return result;
  }, [sortedRehearsals]);
  
  // Format month name
  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  
  // Format date
  const formatDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('-');
    const date = new Date(`${year}-${month}-${day}`);
    
    return date.toLocaleDateString('default', { weekday: 'short', day: 'numeric' });
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-6">Rehearsal Timeline</h2>
      
      {Object.keys(rehearsalsByMonth).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No rehearsals yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          
          {Object.entries(rehearsalsByMonth).map(([monthKey, rehearsals]) => (
            <div key={monthKey} className="mb-8">
              <h3 className="text-lg font-medium mb-4 pl-10 relative">
                <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-blue-500 z-10"></div>
                {formatMonth(monthKey)}
              </h3>
              
              <div className="space-y-4">
                {rehearsals.map(rehearsal => (
                  <div key={rehearsal.id} className="pl-10 relative">
                    <div className="absolute left-4 top-3 w-2 h-2 rounded-full bg-gray-400"></div>
                    
                    <div className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{rehearsal.title}</div>
                          <div className="text-sm text-gray-600">{rehearsal.performanceTitle}</div>
                        </div>
                        <div className="text-sm font-medium text-gray-500">
                          {formatDate(rehearsal.date)}
                        </div>
                      </div>
                      
                      <div className="flex items-center mt-2 text-sm text-gray-500">
                        <div className="flex items-center mr-4">
                          <MapPin size={14} className="mr-1" />
                          {rehearsal.location}
                        </div>
                        <div className="flex items-center mr-4">
                          <Camera size={14} className="mr-1" />
                          {rehearsal.recordings.length} recordings
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RehearsalTimeline;