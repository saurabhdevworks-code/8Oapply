import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function MiniCalendar({ selectedDate, onSelectDate, className = '' }) {
  // Parse initial date (default to today)
  const initial = selectedDate ? new Date(selectedDate) : new Date();
  const validInitial = !isNaN(initial.getTime()) ? initial : new Date();

  const [currentYear, setCurrentYear] = useState(validInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validInitial.getMonth());

  useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  }, [selectedDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Compute days
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Days from previous month to show
  const prevDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevDays.push(totalDaysInPrevMonth - i);
  }

  // Days in current month
  const currentDays = [];
  for (let i = 1; i <= totalDaysInMonth; i++) {
    currentDays.push(i);
  }

  // Remaining slots to make a neat grid of 35 or 42 cells
  const totalSlotsSoFar = prevDays.length + currentDays.length;
  const targetSlots = totalSlotsSoFar > 35 ? 42 : 35;
  const nextDays = [];
  for (let i = 1; i <= targetSlots - totalSlotsSoFar; i++) {
    nextDays.push(i);
  }

  const handleDayClick = (day, monthOffset = 0) => {
    let targetMonth = currentMonth + monthOffset;
    let targetYear = currentYear;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const mm = String(targetMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${targetYear}-${mm}-${dd}`;
    if (onSelectDate) {
      onSelectDate(dateStr);
    }
  };

  return (
    <div
      style={{ borderRadius: '18px' }}
      className={`w-full max-w-[270px] mx-auto p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm select-none ${className}`}
    >
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between mb-3.5 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels (Su, Mo, Tu, We, Th, Fr, Sa) */}
      <div className="grid grid-cols-7 text-center mb-2.5">
        {WEEKDAY_NAMES.map((w) => (
          <span
            key={w}
            className="text-[11px] font-medium text-slate-400 dark:text-slate-500"
          >
            {w}
          </span>
        ))}
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-7 text-center gap-y-1">
        {/* Previous Month Days (Faded) */}
        {prevDays.map((d) => (
          <button
            key={`prev-${d}`}
            type="button"
            onClick={() => handleDayClick(d, -1)}
            className="w-8 h-8 mx-auto flex items-center justify-center text-xs font-normal text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-pointer"
          >
            {d}
          </button>
        ))}

        {/* Current Month Days */}
        {currentDays.map((d) => {
          const mm = String(currentMonth + 1).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          const dateStr = `${currentYear}-${mm}-${dd}`;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={`curr-${d}`}
              type="button"
              onClick={() => handleDayClick(d, 0)}
              className={`w-8 h-8 mx-auto flex items-center justify-center text-xs transition cursor-pointer ${
                isSelected
                  ? 'rounded-full bg-slate-950 text-white dark:bg-blue-600 dark:text-white font-bold shadow-xs'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full font-medium'
              }`}
            >
              {d}
            </button>
          );
        })}

        {/* Next Month Days (Faded) */}
        {nextDays.map((d) => (
          <button
            key={`next-${d}`}
            type="button"
            onClick={() => handleDayClick(d, 1)}
            className="w-8 h-8 mx-auto flex items-center justify-center text-xs font-normal text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 cursor-pointer"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
