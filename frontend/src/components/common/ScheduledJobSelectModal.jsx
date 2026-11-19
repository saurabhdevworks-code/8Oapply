import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Filter,
  Calendar,
  Layers,
  Check,
  CheckSquare,
  Square,
  ExternalLink,
  Play,
  Clock,
  MapPin,
  Sparkles,
  RotateCcw,
  Globe2,
  ChevronDown,
} from 'lucide-react';
import { fetchAppliedJobs } from '../../services/api';
import PlatformLogo from './PlatformLogo';

export default function ScheduledJobSelectModal({
  isOpen,
  onClose,
  selectedJobIds = [],
  onSaveSelection,
  onApplyNow,
}) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set(selectedJobIds || []));
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const [applyingNow, setApplyingNow] = useState(false);
  const dropdownRef = useRef(null);

  // Close platform dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsPlatformDropdownOpen(false);
      }
    };
    if (isPlatformDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isPlatformDropdownOpen]);

  // Sync incoming selected IDs
  useEffect(() => {
    setSelectedIds(new Set(selectedJobIds || []));
  }, [selectedJobIds, isOpen]);

  // Load unapplied jobs from API when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);

    fetchAppliedJobs()
      .then((data) => {
        if (!isMounted) return;
        // Filter strictly to unapplied jobs
        const unapplied = (data || []).filter(
          (j) => (j.status || '').trim().toLowerCase() === 'not applied'
        );
        setJobs(unapplied);
      })
      .catch((err) => {
        console.error('Failed to load jobs for selection modal:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Extract unique platforms
  const availablePlatforms = useMemo(() => {
    const plats = new Set();
    jobs.forEach((j) => {
      if (j.platform) plats.add(j.platform);
    });
    return Array.from(plats);
  }, [jobs]);

  // Extract unique dates (YYYY-MM-DD)
  const availableDates = useMemo(() => {
    const dates = new Set();
    jobs.forEach((j) => {
      const d = (j.date || '').slice(0, 10);
      if (d && d.startsWith('202')) dates.add(d);
    });
    return Array.from(dates).sort().reverse();
  }, [jobs]);

  // Filter jobs based on search, platform, and date
  const filteredJobs = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().slice(0, 10);

    return jobs.filter((job) => {
      // Platform filter
      if (platformFilter !== 'all' && job.platform?.toLowerCase() !== platformFilter.toLowerCase()) {
        return false;
      }

      // Date filter
      const jobDate = (job.date || '').slice(0, 10);
      if (dateFilter === 'today') {
        if (jobDate !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (jobDate !== yesterdayStr) return false;
      } else if (dateFilter === 'last7days') {
        if (jobDate < sevenDaysStr) return false;
      } else if (dateFilter !== 'all') {
        // Specific date selected
        if (jobDate !== dateFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (job.job_title || '').toLowerCase().includes(q);
        const compMatch = (job.company || '').toLowerCase().includes(q);
        if (!titleMatch && !compMatch) return false;
      }

      return true;
    });
  }, [jobs, platformFilter, dateFilter, searchQuery]);

  // Handle individual toggle
  const toggleSelectJob = (jobId) => {
    const next = new Set(selectedIds);
    if (next.has(jobId)) {
      next.delete(jobId);
    } else {
      next.add(jobId);
    }
    setSelectedIds(next);
  };

  // Handle select all filtered
  const handleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredJobs.forEach((j) => {
      if (j.job_id) next.add(j.job_id);
    });
    setSelectedIds(next);
  };

  // Handle deselect all filtered
  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredJobs.forEach((j) => {
      if (j.job_id) next.delete(j.job_id);
    });
    setSelectedIds(next);
  };

  const isAllFilteredSelected =
    filteredJobs.length > 0 &&
    filteredJobs.every((j) => selectedIds.has(j.job_id));

  // Save for scheduled run
  const handleConfirmSave = () => {
    if (onSaveSelection) {
      onSaveSelection(Array.from(selectedIds));
    }
    onClose();
  };

  // Immediate execution trigger
  const handleTriggerApplyNow = async () => {
    if (selectedIds.size === 0) return;
    setApplyingNow(true);
    try {
      if (onApplyNow) {
        await onApplyNow(Array.from(selectedIds));
      }
      onClose();
    } catch (err) {
      console.error('Error applying now to selected:', err);
    } finally {
      setApplyingNow(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        // ONLY close if clicking the outer backdrop directly
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      {/* Compact, balanced Modal Window matching system style */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl sm:max-w-4xl h-[82vh] max-h-[660px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Select Unapplied Jobs for Schedule
                </h2>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Targeted Queue
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Filter by date & platform, select jobs to apply to at your scheduled time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Close popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[140px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Custom Platform Filter Dropdown with Platform Icons in List */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsPlatformDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer"
              >
                {platformFilter !== 'all' ? (
                  <PlatformLogo id={platformFilter} className="w-3.5 h-3.5 rounded-[3px] shrink-0" />
                ) : (
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{platformFilter === 'all' ? `All Platforms (${availablePlatforms.length})` : platformFilter}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isPlatformDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPlatformDropdownOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatformFilter('all');
                      setIsPlatformDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                      platformFilter === 'all' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>All Platforms ({availablePlatforms.length})</span>
                    </div>
                    {platformFilter === 'all' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />}
                  </button>

                  {availablePlatforms.map((p) => {
                    const isSelected = platformFilter.toLowerCase() === p.toLowerCase();
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPlatformFilter(p);
                          setIsPlatformDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                          isSelected ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PlatformLogo id={p} className="w-3.5 h-3.5 rounded-[3px] shrink-0" />
                          <span>{p}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 shadow-2xs">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    Date: {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Counter Badges */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 whitespace-nowrap">
              {selectedIds.size} of {jobs.length} Selected
            </span>
          </div>
        </div>

        {/* Master Select All Header Bar */}
        <div className="px-5 py-2 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shrink-0 select-none">
          <div
            onClick={isAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* Master Checkbox */}
            <div
              className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition shrink-0 ${
                isAllFilteredSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                  : selectedIds.size > 0
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600'
                  : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 group-hover:border-blue-400'
              }`}
            >
              {isAllFilteredSelected ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : selectedIds.size > 0 ? (
                <div className="w-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                Select All ({filteredJobs.length} Unapplied Jobs)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                {isAllFilteredSelected
                  ? '— Click to deselect all'
                  : `— Click to select all ${filteredJobs.length} matching`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={isAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
            className="text-xs font-semibold px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-2xs"
          >
            {isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredJobs.length})`}
          </button>
        </div>

        {/* Jobs List Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-1.5">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Clock className="w-6 h-6 animate-spin text-blue-500" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">Loading unapplied jobs...</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Layers className="w-9 h-9 text-slate-300 dark:text-slate-700 stroke-1" />
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                No unapplied jobs match the active filters
              </span>
              <span>Try clearing the platform or date filter to view more listings.</span>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const isSelected = selectedIds.has(job.job_id);

              return (
                <div
                  key={job.job_id || job.url}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectJob(job.job_id);
                  }}
                  className={`p-2.5 sm:p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 select-none ${
                    isSelected
                      ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-2xs'
                      : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Job Details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                          {job.job_title}
                        </span>
                        {/* Platform name with Icon (No background) */}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <PlatformLogo id={job.platform} className="w-3.5 h-3.5 rounded-[3px]" />
                          <span>{job.platform}</span>
                        </span>
                        <span className="text-[10.5px] text-slate-400">
                          {job.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{job.company}</span>
                        {job.location && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{job.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions / View Link */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="View job posting in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                      Not Applied
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedIds.size}</span> jobs queued for scheduled application
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            {onApplyNow && (
              <button
                type="button"
                onClick={handleTriggerApplyNow}
                disabled={selectedIds.size === 0 || applyingNow}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                title="Immediately apply to the selected jobs"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Apply Selected Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmSave}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Confirm for Schedule ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
