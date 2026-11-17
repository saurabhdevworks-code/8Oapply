import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarModal({ isOpen, onClose, selectedDate, onSelectDate }) {
  const initial = selectedDate ? new Date(selectedDate) : new Date();
  const validInitial = !isNaN(initial.getTime()) ? initial : new Date();

  const [currentYear, setCurrentYear] = useState(validInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validInitial.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState(
    selectedDate || new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (selectedDate) {
      setTempSelectedDate(selectedDate);
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  }, [selectedDate, isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const prevDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevDays.push(totalDaysInPrevMonth - i);
  }

  const currentDays = [];
  for (let i = 1; i <= totalDaysInMonth; i++) {
    currentDays.push(i);
  }

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
    setTempSelectedDate(dateStr);
    if (onSelectDate) {
      onSelectDate(dateStr);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${today.getFullYear()}-${mm}-${dd}`;
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setTempSelectedDate(dateStr);
    if (onSelectDate) {
      onSelectDate(dateStr);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: '18px' }}
        className="w-full max-w-[290px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xl select-none relative"
      >
        {/* Close Button at top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer p-1"
          title="Close Calendar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Month & Year Navigation Header */}
        <div className="flex items-center justify-between mb-3 px-1 pr-6">
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
            const isSelected = dateStr === tempSelectedDate;

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

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleTodayClick}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              style={{ borderRadius: '4px' }}
              className="px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ borderRadius: '4px' }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Set Date
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
