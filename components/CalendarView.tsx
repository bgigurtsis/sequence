// components/CalendarView.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Video } from 'lucide-react';
import { usePerformances } from '../contexts/PerformanceContext';
import { Rehearsal } from '../types';

interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  rehearsals: Rehearsal[];
  onSelectDate: (date: Date, rehearsals: Rehearsal[]) => void;
}

const CalendarDay: React.FC<CalendarDayProps> = ({ 
  date, isCurrentMonth, rehearsals, onSelectDate
}) => {
  const hasRehearsals = rehearsals.length > 0;
  const isToday = new Date().toDateString() === date.toDateString();
  
  return (
    <div 
      onClick={() => onSelectDate(date, rehearsals)}
      className={`
        border rounded-md p-2 h-24 overflow-hidden flex flex-col
        ${isCurrentMonth ? 'bg-white' : 'bg-gray-100 text-gray-400'} 
        ${hasRehearsals ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}
        ${isToday ? 'border-blue-500 border-2' : ''}
      `}
    >
      <span className="text-sm font-medium">{date.getDate()}</span>
      {hasRehearsals && (
        <div className="mt-1 text-xs">
          {rehearsals.slice(0, 2).map(r => (
            <div key={r.id} className="truncate text-blue-600">{r.title}</div>
          ))}
          {rehearsals.length > 2 && (
            <div className="text-gray-500">+{rehearsals.length - 2} more</div>
          )}
        </div>
      )}
    </div>
  );
};

const CalendarView: React.FC = () => {
  const { performances } = usePerformances();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRehearsals, setSelectedRehearsals] = useState<Rehearsal[]>([]);
  
  // Go to previous month
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  // Go to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  // Get month name and year
  const monthYearString = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [currentDate]);
  
  // Map all rehearsals to dates
  const rehearsalsByDate = useMemo(() => {
    const map = new Map<string, Rehearsal[]>();
    
    performances.forEach(performance => {
      performance.rehearsals.forEach(rehearsal => {
        // Convert from DD-MM-YYYY to YYYY-MM-DD for proper date sorting
        const dateParts = rehearsal.date.split('-');
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        
        const dateKey = isoDate;
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push({
          ...rehearsal,
          performanceId: performance.id,
          performanceTitle: performance.title
        });
      });
    });
    
    return map;
  }, [performances]);
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate how many days from the previous month to show
    const daysFromPrevMonth = firstDayOfWeek;
    
    // Calculate total days needed (previous month days + current month days)
    const totalDays = daysFromPrevMonth + lastDay.getDate();
    
    // Calculate how many weeks we need (rounded up)
    const totalWeeks = Math.ceil(totalDays / 7);
    
    const days: Date[] = [];
    
    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // Add days from current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month to fill out the grid
    const remainingDays = totalWeeks * 7 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [currentDate]);
  
  const handleSelectDate = (date: Date, rehearsals: Rehearsal[]) => {
    setSelectedDate(date);
    setSelectedRehearsals(rehearsals);
  };
  
  // Get rehearsals for a given date
  const getRehearsalsForDate = (date: Date): Rehearsal[] => {
    const dateStr = date.toISOString().split('T')[0];
    // Convert from YYYY-MM-DD to DD-MM-YYYY for lookup
    const dateParts = dateStr.split('-');
    const lookupDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    
    return rehearsalsByDate.get(dateStr) || [];
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Rehearsal Calendar</h2>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Today
          </button>
          
          <button
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      {/* Calendar explanation */}
      <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm flex items-start">
        <Info size={16} className="text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
        <p>
          View all your scheduled rehearsals in calendar format. 
          Dates with rehearsals are highlighted. Click on a date to see rehearsals scheduled for that day.
        </p>
      </div>
      
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          const rehearsals = getRehearsalsForDate(date);
          const hasRehearsals = rehearsals.length > 0;
          const totalRecordings = rehearsals.reduce((sum, r) => sum + (r.recordings?.length || 0), 0);
          
          return (
            <div
              key={index}
              className={`
                p-1 min-h-[70px] border rounded relative
                ${date.getMonth() === currentDate.getMonth() ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                ${date.toDateString() === new Date().toDateString() ? 'border-blue-500' : 'border-gray-200'}
                ${hasRehearsals ? 'hover:border-blue-300 cursor-pointer' : ''}
              `}
              onClick={() => {
                if (hasRehearsals && rehearsals.length === 1) {
                  // If there's only one rehearsal, select it directly
                  handleSelectDate(date, rehearsals);
                } else if (hasRehearsals) {
                  // If there are multiple rehearsals, show a modal or expand the day
                  // For now, just select the first one
                  handleSelectDate(date, rehearsals);
                }
              }}
            >
              <div className="text-right mb-1">
                {date.getDate()}
              </div>
              
              {hasRehearsals && (
                <div className="text-xs">
                  {rehearsals.length > 1 ? (
                    <div className="bg-blue-100 text-blue-800 rounded px-1 py-0.5 text-center">
                      {rehearsals.length} rehearsals
                    </div>
                  ) : (
                    <div className="truncate text-blue-600">
                      {rehearsals[0].title}
                    </div>
                  )}
                  
                  {totalRecordings > 0 && (
                    <div className="flex items-center justify-center mt-1 text-gray-600">
                      <Video size={10} className="mr-1" />
                      <span>{totalRecordings}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Today indicator */}
              {date.toDateString() === new Date().toDateString() && (
                <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Selected date details */}
      {selectedDate && (
        <div className="mt-4 border-t pt-4">
          <h3 className="font-medium">
            {selectedDate.toLocaleDateString('default', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          
          {selectedRehearsals.length > 0 ? (
            <div className="mt-2 space-y-2">
              {selectedRehearsals.map(rehearsal => (
                <div key={rehearsal.id} className="p-2 bg-blue-50 rounded">
                  <div className="font-medium">{rehearsal.title}</div>
                  <div className="text-sm text-gray-500">
                    {rehearsal.performanceTitle} • {rehearsal.location}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 mt-2">No rehearsals scheduled</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;