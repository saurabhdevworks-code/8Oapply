import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { fetchAppliedJobs } from '../../services/api';

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
  const [applyingNow, setApplyingNow] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Select Unapplied Jobs for Schedule</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Mode 2: Targeted Queue
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filter by date & platform, select jobs, and the scheduler will apply only to them at your set time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters Bar: Platform & Date Filters */}
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-52"
              />
            </div>

            {/* Platform Filter Dropdown */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Platforms</option>
                {availablePlatforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
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

          {/* Quick Selection Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={isAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
              className="text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <>
                  <Square className="w-3 h-3 text-slate-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <CheckSquare className="w-3 h-3 text-blue-500" />
                  <span>Select All ({filteredJobs.length})</span>
                </>
              )}
            </button>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
              {selectedIds.size} Selected
            </span>
          </div>
        </div>

        {/* Jobs List Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Clock className="w-5 h-5 animate-spin text-slate-400" />
              <span>Loading unapplied jobs...</span>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
              <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 stroke-1" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">
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
                  onClick={() => toggleSelectJob(job.job_id)}
                  className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/10'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </div>

                    {/* Job Details */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {job.job_title}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {job.platform}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {job.date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {job.company}
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
                        className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
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
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIds.size}</span> jobs queued for scheduled application
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            {onApplyNow && (
              <button
                onClick={handleTriggerApplyNow}
                disabled={selectedIds.size === 0 || applyingNow}
                className="px-3.5 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                title="Immediately apply to the selected jobs"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Apply Selected Now</span>
              </button>
            )}

            <button
              onClick={handleConfirmSave}
              className="px-4 py-1.5 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
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
