import React, { useState, useEffect, useRef } from 'react';
import { useBot } from '../../context/BotContext';
import {
  Crosshair,
  Plus,
  X,
  Sparkles,
  MapPin,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
} from 'lucide-react';

const AGE_PRESETS = [
  { label: 'Past 24 Hours', value: 1 },
  { label: 'Past 3 Days', value: 3 },
  { label: 'Past 7 Days', value: 7 },
  { label: 'Past 14 Days', value: 14 },
  { label: 'Past 30 Days', value: 30 },
  { label: 'Any Time', value: 0 },
];

export default function TargetsPage() {
  const { config, updateConfigValue, handleSaveConfig, showToast } = useBot();
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const debounceTimerRef = useRef(null);

  if (!config) {
    return <div className="text-slate-500 text-xs">Loading search targets...</div>;
  }

  const jobTitles = config.job_titles || [];
  const locations = config.locations || [];

  const triggerAutoSave = (updatedConfig) => {
    setSaveStatus('saving');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await handleSaveConfig(updatedConfig);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        setSaveStatus('idle');
      }
    }, 600);
  };

  const addTitle = (e) => {
    e?.preventDefault();
    const trimmed = newTitle.trim();
    if (trimmed && !jobTitles.includes(trimmed)) {
      const updated = [...jobTitles, trimmed];
      updateConfigValue('job_titles', updated);
      triggerAutoSave({ ...config, job_titles: updated });
      setNewTitle('');
    }
  };

  const removeTitle = (titleToRemove) => {
    const updated = jobTitles.filter((t) => t !== titleToRemove);
    updateConfigValue('job_titles', updated);
    triggerAutoSave({ ...config, job_titles: updated });
  };

  const addLocation = (e) => {
    e?.preventDefault();
    const trimmed = newLocation.trim();
    if (trimmed && !locations.includes(trimmed)) {
      const updated = [...locations, trimmed];
      updateConfigValue('locations', updated);
      triggerAutoSave({ ...config, locations: updated });
      setNewLocation('');
    }
  };

  const removeLocation = (locToRemove) => {
    const updated = locations.filter((l) => l !== locToRemove);
    updateConfigValue('locations', updated);
    triggerAutoSave({ ...config, locations: updated });
  };

  const handleFieldChange = (key, value) => {
    updateConfigValue(key, value);
    triggerAutoSave({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Top Header - No Background Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <Crosshair className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Search Targets & Preferences
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Defines the role titles, locations, and skills queried across all active platforms.
            </p>
          </div>
        </div>

        {/* Auto-Save State */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Saving
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-mono">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Grid: Target Titles and Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job Titles Card */}
        <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Target Job Titles ({jobTitles.length})
                </h3>
              </div>
            </div>

            <form onSubmit={addTitle} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Software Engineer, Full Stack Developer, SDE"
                className="flex-1 px-3 py-1.5 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Chips Container */}
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-0.5 min-h-[44px] items-center">
              {jobTitles.length === 0 ? (
                <span className="text-slate-400 dark:text-slate-500 text-xs italic">
                  No target roles added yet. Enter a role title above to add.
                </span>
              ) : (
                jobTitles.map((title) => (
                  <span
                    key={title}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 font-bold"
                  >
                    <span>{title}</span>
                    <button
                      type="button"
                      onClick={() => removeTitle(title)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            Press enter or click Add to append titles to the rotation.
          </div>
        </div>

        {/* Locations Card */}
        <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Target Locations ({locations.length})
                </h3>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Domestic India</span>
            </div>

            <form onSubmit={addLocation} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Bangalore, Hyderabad, Pune, Remote"
                className="flex-1 px-3 py-1.5 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {/* Chips Container */}
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-0.5 min-h-[44px] items-center">
              {locations.length === 0 ? (
                <span className="text-slate-400 dark:text-slate-500 text-xs italic">
                  No target locations added yet. Enter a city or Remote above to add.
                </span>
              ) : (
                locations.map((loc) => (
                  <span
                    key={loc}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-bold"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => removeLocation(loc)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            Strictly searches Indian tech hubs & India-authorized remote positions.
          </div>
        </div>
      </div>

      {/* Job Post Age / Freshness Window Filter */}
      <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Job Posting Date
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Collect and apply to job listings posted within this timeframe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
            {/* Dropdown for Age Presets */}
            <select
              value={AGE_PRESETS.some((p) => p.value === (config.job_post_age_days ?? 7)) ? (config.job_post_age_days ?? 7) : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  handleFieldChange('job_post_age_days', parseInt(e.target.value, 10));
                }
              }}
              className="px-2.5 py-1 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer font-medium"
            >
              {AGE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              {!AGE_PRESETS.some((p) => p.value === (config.job_post_age_days ?? 7)) && (
                <option value="custom">Custom ({config.job_post_age_days} days)</option>
              )}
            </select>

            {/* Custom Input */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-[6px] px-2.5 py-1 shrink-0 shadow-2xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Custom:</span>
              <input
                type="number"
                min="0"
                max="90"
                value={config.job_post_age_days ?? 7}
                onChange={(e) => handleFieldChange('job_post_age_days', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-10 text-center bg-transparent !bg-transparent border-0 focus:outline-none text-xs font-mono font-bold text-blue-600 dark:text-blue-400 p-0 shadow-none ring-0 outline-none"
                style={{ backgroundColor: 'transparent' }}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Cover Note */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Skills & Salary */}
        <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Matching Skills & Compensation</h3>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Skills List (comma-separated keyword matchers)
            </label>
            <textarea
              rows={3}
              value={config.skills || ''}
              onChange={(e) => handleFieldChange('skills', e.target.value)}
              placeholder="Auto-extracted from resume or enter skills (e.g. Java, Python, React)"
              className="w-full px-3 py-2 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Salary (LPA)
              </label>
              <input
                type="text"
                value={config.salary || ''}
                onChange={(e) => handleFieldChange('salary', e.target.value)}
                placeholder="e.g. 8"
                className="w-full px-2.5 py-1.5 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected CTC (INR)
              </label>
              <input
                type="text"
                value={config.expected_ctc || ''}
                onChange={(e) => handleFieldChange('expected_ctc', e.target.value)}
                placeholder="e.g. 800000"
                className="w-full px-2.5 py-1.5 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Cover Letter Field */}
        <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Application Cover Statement</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {(config.cover_note || '').length} chars
              </span>
            </div>
            <textarea
              rows={5}
              value={config.cover_note || ''}
              onChange={(e) => handleFieldChange('cover_note', e.target.value)}
              placeholder="Candidate statement automatically populated in portal forms"
              className="w-full px-3 py-2 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 leading-relaxed"
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Automatically populated in portal forms requiring introductory text.
          </div>
        </div>
      </div>
    </div>
  );
}
