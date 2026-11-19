import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  X,
  Trash2,
  Plus,
  Check,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useBot } from '../../context/BotContext';
import CalendarModal from './CalendarModal';
import ScheduleWatchModal from './ScheduleWatchModal';
import ScheduledJobSelectModal from './ScheduledJobSelectModal';
import { applySelectedJobsNow } from '../../services/api';

const TIME_PRESETS = [
  { label: '09:30 AM', time24: '09:30' },
  { label: '01:00 PM', time24: '13:00' },
  { label: '05:30 PM', time24: '17:30' },
  { label: '09:00 PM', time24: '21:00' },
];

const DAYS_OF_WEEK = [
  { id: 'mon', label: 'M', full: 'Mon' },
  { id: 'tue', label: 'T', full: 'Tue' },
  { id: 'wed', label: 'W', full: 'Wed' },
  { id: 'thu', label: 'T', full: 'Thu' },
  { id: 'fri', label: 'F', full: 'Fri' },
  { id: 'sat', label: 'S', full: 'Sat' },
  { id: 'sun', label: 'S', full: 'Sun' },
];

export default function ScheduleConfigModal({ isOpen, onClose }) {
  const { config, updateConfigValue, handleSaveConfig, showToast } = useBot();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isWatchModalOpen, setIsWatchModalOpen] = useState(false);
  const [editingWatchTime, setEditingWatchTime] = useState(null);
  const [isJobSelectModalOpen, setIsJobSelectModalOpen] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showAddCustomTime, setShowAddCustomTime] = useState(false);
  const [editingChipTime, setEditingChipTime] = useState(null);
  const [editingChipValue, setEditingChipValue] = useState('');

  if (!isOpen) return null;

  const rawTimes = Array.isArray(config.scheduled_times)
    ? config.scheduled_times
    : config.scheduled_times
    ? [config.scheduled_times]
    : [];
  const scheduledTimes = Array.from(new Set(rawTimes.filter(Boolean))).sort();
  const activeDays = config.scheduler_days || ['mon', 'tue', 'wed', 'thu', 'fri'];
  const cadenceMode = config.scheduler_mode || 'onetime';
  const selectedDateStr = config.scheduler_date || new Date().toISOString().split('T')[0];

  const isOneTime = cadenceMode === 'onetime';
  const isEveryDay = cadenceMode === 'everyday';
  const isWeekdaysOnly = cadenceMode === 'weekdays';

  // Format 24h to 12h
  const format12h = (time24) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${period}`;
  };

  // Format date: Wed, Nov 18, 2026
  const formatDateDisplay = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formattedSelectedDate = formatDateDisplay(selectedDateStr);

  // Parse time flexibly (e.g. "5 PM", "5PM", "5:00 PM", "17:00", "5p", "17")
  const parseTimeTo24h = (str) => {
    if (!str) return null;
    const s = str.trim().toLowerCase();
    // 12-hour format: "5 pm", "5pm", "5:00 pm", "5:30pm", "5p"
    const match12 = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a|p)$/);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2] ? parseInt(match12[2], 10) : 0;
      const period = match12[3].startsWith('p') ? 'pm' : 'am';
      if (h < 1 || h > 12 || m < 0 || m > 59) return null;
      if (period === 'pm' && h < 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // 24-hour format: "17:00", "17", "09:30"
    const match24 = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (match24) {
      let h = parseInt(match24[1], 10);
      const m = match24[2] ? parseInt(match24[2], 10) : 0;
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  };

  // Change cadence
  const handleSetFrequency = async (mode) => {
    let days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    if (mode === 'weekdays') days = ['mon', 'tue', 'wed', 'thu', 'fri'];

    const newCfg = {
      ...config,
      scheduler_mode: mode,
      scheduler_days: days,
    };
    updateConfigValue('scheduler_mode', mode);
    updateConfigValue('scheduler_days', days);
    await handleSaveConfig(newCfg, true);
  };

  // Toggle day
  const handleToggleDay = async (dayId) => {
    let next = activeDays.includes(dayId)
      ? activeDays.filter((d) => d !== dayId)
      : [...activeDays, dayId];

    if (next.length === 0) next = [dayId];

    const newCfg = {
      ...config,
      scheduler_days: next,
      scheduler_mode: 'weekly',
    };
    updateConfigValue('scheduler_days', next);
    updateConfigValue('scheduler_mode', 'weekly');
    await handleSaveConfig(newCfg, true);
  };

  // Sync both scheduled_times and schedules
  const updateTimesAndSchedules = async (nextTimes, toastMsg = null) => {
    const updatedSchedules = nextTimes.map((t, idx) => ({
      id: config.schedules?.[idx]?.id || `sched_${idx + 1}`,
      name: config.schedules?.[idx]?.name || (nextTimes.length === 1 ? 'Daily Pipeline' : `Daily Pipeline ${idx + 1}`),
      time: t,
      frequency: config.scheduler_mode || 'everyday',
      days: config.scheduler_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      date: config.scheduler_date || new Date().toISOString().split('T')[0],
      action_mode: config.scheduler_action_mode || 'fetch_and_apply',
      enabled: true,
      selected_jobs: config.scheduled_selected_jobs || [],
    }));
    const newCfg = {
      ...config,
      scheduled_times: nextTimes,
      schedules: updatedSchedules,
    };
    updateConfigValue('scheduled_times', nextTimes);
    updateConfigValue('schedules', updatedSchedules);
    await handleSaveConfig(newCfg, true);
    if (toastMsg) showToast(toastMsg, 'success');
  };

  // Add preset time
  const handleAddPresetTime = async (time24) => {
    if (scheduledTimes.includes(time24)) return;
    const nextTimes = [...scheduledTimes, time24].sort();
    await updateTimesAndSchedules(nextTimes, `Scheduled time added for ${format12h(time24)}`);
  };

  // Remove time
  const handleRemoveTime = async (time24) => {
    const nextTimes = scheduledTimes.filter((t) => t !== time24);
    await updateTimesAndSchedules(nextTimes, 'Execution time removed');
  };

  // Add custom time
  const handleAddCustomTimeSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const parsed = parseTimeTo24h(customTimeInput);
    if (!parsed) {
      showToast('Please enter a valid time (e.g. 5:00 PM or 5 PM)', 'error');
      return;
    }
    await handleAddPresetTime(parsed);
    setCustomTimeInput('');
    setShowAddCustomTime(false);
  };

  // Handle inline edit for an existing time chip
  const handleSaveChipEdit = async (oldTime24, inputValue) => {
    setEditingChipTime(null);
    if (!inputValue) return;
    const newTime24 = parseTimeTo24h(inputValue);
    if (!newTime24) {
      showToast('Please enter a valid time (e.g. 5:00 PM or 5 PM)', 'error');
      return;
    }
    if (newTime24 === oldTime24) return;
    let nextTimes = scheduledTimes.map((t) => (t === oldTime24 ? newTime24 : t));
    nextTimes = Array.from(new Set(nextTimes)).sort();
    await updateTimesAndSchedules(nextTimes, `Time updated to ${format12h(newTime24)}`);
  };

  // Calendar date select
  const handleCalendarDateSelect = async (newDate) => {
    setIsCalendarOpen(false);
    const newCfg = {
      ...config,
      scheduler_date: newDate,
      scheduler_mode: 'onetime',
    };
    updateConfigValue('scheduler_date', newDate);
    updateConfigValue('scheduler_mode', 'onetime');
    await handleSaveConfig(newCfg, true);
    showToast(`Execution date updated to ${newDate}`, 'success');
  };

  // Watch dial time save
  const handleSaveFromWatchModal = async (time24) => {
    let nextTimes = [time24];
    if (editingWatchTime && scheduledTimes.includes(editingWatchTime)) {
      nextTimes = scheduledTimes.map((t) => (t === editingWatchTime ? time24 : t));
    } else {
      nextTimes = scheduledTimes.includes(time24) ? scheduledTimes : [...scheduledTimes, time24].sort();
    }
    await updateTimesAndSchedules(nextTimes, `Time set to ${format12h(time24)}`);
    setIsWatchModalOpen(false);
    setEditingWatchTime(null);
    setShowAddCustomTime(false);
    setCustomTimeInput('');
  };

  // Mode 2: Save job selection
  const handleSaveJobSelection = async (jobIds) => {
    const updatedConfig = {
      ...config,
      scheduler_action_mode: 'selected_jobs',
      scheduled_selected_jobs: jobIds,
    };
    updateConfigValue('scheduler_action_mode', 'selected_jobs');
    updateConfigValue('scheduled_selected_jobs', jobIds);
    await handleSaveConfig(updatedConfig, true);
    showToast(`Saved ${jobIds.length} jobs for scheduled apply!`, 'success');
  };

  // Mode 2: Apply now
  const handleApplySelectedJobsNow = async (jobIds) => {
    try {
      await applySelectedJobsNow(jobIds);
      showToast(`Started application for ${jobIds.length} selected jobs!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to apply to selected jobs', 'error');
    }
  };

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[92vh]"
        >
        {/* Header matching uploaded image */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Daily Routine & Execution Schedule
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {scheduledTimes.length} Run{scheduledTimes.length > 1 ? 's' : ''} Configured
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4.5 space-y-4 overflow-y-auto">
          {/* Active Days Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Active Days
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleSetFrequency('onetime');
                    setIsCalendarOpen(true);
                  }}
                  className={`px-2.5 py-1 rounded-[5px] text-xs font-semibold border transition cursor-pointer ${
                    isOneTime
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  One time
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFrequency('everyday')}
                  className={`px-2.5 py-1 rounded-[5px] text-xs font-semibold border transition cursor-pointer ${
                    isEveryDay
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  All 7 Days
                </button>

              </div>
            </div>

            {/* Run Date Card as in uploaded image */}
            {isOneTime ? (
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="w-full h-10 flex items-center justify-between px-3 bg-blue-50/70 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/40 rounded-lg hover:border-blue-500 transition cursor-pointer text-xs group"
                title="Click to change execution date"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Run Date:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formattedSelectedDate}
                  </span>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                  Change Date &rarr;
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = activeDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleToggleDay(d.id)}
                      className={`py-1.5 rounded-md text-xs font-bold text-center border transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500/50 text-blue-700 dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Subtext description as in image */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isOneTime ? (
                <span>
                  One-time run scheduled for {formattedSelectedDate} at {scheduledTimes.map(format12h).join(', ')}
                </span>
              ) : isEveryDay ? (
                <span>
                  Daily routine set for Monday to Sunday at {scheduledTimes.map(format12h).join(', ')}
                </span>
              ) : isWeekdaysOnly ? (
                <span>
                  Weekdays routine set for Monday to Friday at {scheduledTimes.map(format12h).join(', ')}
                </span>
              ) : (
                <span>
                  Runs on {activeDays.map((d) => d.toUpperCase()).join(', ')} at {scheduledTimes.map(format12h).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Scheduled Execution Times Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Scheduled Execution Times
            </span>

            {/* List of Time Chips */}
            <div className="flex flex-wrap gap-2 items-center">
              {scheduledTimes.map((t) => (
                <div
                  key={t}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs hover:border-blue-300 transition"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWatchTime(t);
                      setIsWatchModalOpen(true);
                    }}
                    className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/25 transition cursor-pointer shrink-0"
                    title="Change time on clock dial"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                  {editingChipTime === t ? (
                    <input
                      type="text"
                      value={editingChipValue}
                      onChange={(e) => setEditingChipValue(e.target.value)}
                      onBlur={() => handleSaveChipEdit(t, editingChipValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveChipEdit(t, editingChipValue);
                        } else if (e.key === 'Escape') {
                          setEditingChipTime(null);
                        }
                      }}
                      autoFocus
                      className="w-[68px] text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-blue-500 rounded px-1 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingChipTime(t);
                        setEditingChipValue(format12h(t));
                      }}
                      className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      title="Click to edit time directly"
                    >
                      {format12h(t)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(t)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer ml-1"
                    title="Delete this execution time"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Time Button / In-place Interactive Time Chip */}
              {showAddCustomTime ? (
                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition">
                  {/* Watch icon with light background */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWatchTime(null);
                      setIsWatchModalOpen(true);
                    }}
                    className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/25 transition cursor-pointer shrink-0"
                    title="Open clock dial to pick time"
                  >
                    <Clock className="w-3 h-3" />
                  </button>

                  {/* Manually editable time input */}
                  <input
                    type="text"
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    placeholder="09:30 AM"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTimeSubmit();
                      } else if (e.key === 'Escape') {
                        setShowAddCustomTime(false);
                      }
                    }}
                    className="w-[66px] text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                  />

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={handleAddCustomTimeSubmit}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs font-bold hover:underline cursor-pointer"
                    title="Save and add time"
                  >
                    Add
                  </button>

                  {/* Cancel button */}
                  <button
                    type="button"
                    onClick={() => setShowAddCustomTime(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer p-0.5"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomTime(true);
                    setCustomTimeInput('09:30 AM');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-500/10 transition cursor-pointer"
                  title="Add new scheduled execution time"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Time</span>
                </button>
              )}
            </div>

            </div>

          {/* 2-Way Scheduler Execution Modes (Mode 1 & Mode 2) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Execution Mode
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Mode 1 */}
              <div
                onClick={async () => {
                  updateConfigValue('scheduler_action_mode', 'fetch_and_apply');
                  await handleSaveConfig({ ...config, scheduler_action_mode: 'fetch_and_apply' }, true);
                }}
                className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  (config.scheduler_action_mode || 'fetch_and_apply') === 'fetch_and_apply'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      1. Fetch & Auto-Apply
                    </span>
                  </div>
                  {(config.scheduler_action_mode || 'fetch_and_apply') === 'fetch_and_apply' && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  At scheduled time: Crawls new jobs & auto-applies.
                </p>
              </div>

              {/* Mode 2 */}
              <div
                onClick={async () => {
                  updateConfigValue('scheduler_action_mode', 'selected_jobs');
                  await handleSaveConfig({ ...config, scheduler_action_mode: 'selected_jobs' }, true);
                  setIsJobSelectModalOpen(true);
                }}
                className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  config.scheduler_action_mode === 'selected_jobs'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      2. Apply Selected Jobs
                    </span>
                  </div>
                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {(config.scheduled_selected_jobs || []).length} queued
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  Select unapplied jobs with Date & Platform filters.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateConfigValue('scheduler_action_mode', 'selected_jobs');
                    setIsJobSelectModalOpen(true);
                  }}
                  className="mt-0.5 text-[10.5px] font-bold py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Layers className="w-3 h-3" />
                  <span>Select Jobs ({(config.scheduled_selected_jobs || []).length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Master Enable Switch */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.scheduler_enabled !== false}
                onChange={async (e) => {
                  const val = e.target.checked;
                  updateConfigValue('scheduler_enabled', val);
                  await handleSaveConfig({ ...config, scheduler_enabled: val }, true);
                  showToast(val ? 'Scheduler enabled' : 'Scheduler paused', 'info');
                }}
                className="sr-only"
              />
              <div
                className={`w-8 h-4.5 rounded-full transition-colors duration-200 relative shadow-inner ${
                  config.scheduler_enabled !== false ? 'bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-[1.5px] w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                    config.scheduler_enabled !== false ? 'translate-x-[15px]' : 'translate-x-[1.5px]'
                  }`}
                />
              </div>
            </label>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {config.scheduler_enabled !== false ? 'Schedule Active' : 'Schedule Paused'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shadow-2xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Embedded Calendar Modal */}
    <CalendarModal
      isOpen={isCalendarOpen}
      onClose={() => setIsCalendarOpen(false)}
      selectedDate={selectedDateStr}
      onSelectDate={handleCalendarDateSelect}
    />

    {/* Embedded Clock Dial Watch Modal */}
    <ScheduleWatchModal
      isOpen={isWatchModalOpen}
      onClose={() => {
        setIsWatchModalOpen(false);
        setEditingWatchTime(null);
      }}
      initialTime={editingWatchTime}
      onSaveTime={handleSaveFromWatchModal}
    />

    {/* Embedded Mode 2 Unapplied Job Select Modal */}
    <ScheduledJobSelectModal
      isOpen={isJobSelectModalOpen}
      onClose={() => setIsJobSelectModalOpen(false)}
      selectedJobIds={config.scheduled_selected_jobs || []}
      onSaveSelection={handleSaveJobSelection}
      onApplyNow={handleApplySelectedJobsNow}
    />
  </>
);
}
