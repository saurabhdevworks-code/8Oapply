import React, { useState, useEffect, useRef } from 'react';
import { useBot } from '../../context/BotContext';
import { fetchAppliedJobs, fetchCollectorJobs, runJobCollector } from '../../services/api';
import ScallopBadge from '../../components/common/ScallopBadge';
import PlatformLogo from '../../components/common/PlatformLogo';
import ScheduleWatchModal from '../../components/common/ScheduleWatchModal';
import CustomSelect from '../../components/common/CustomSelect';
import {
  Briefcase,
  Send,
  Activity,
  Calendar,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Globe2,
  Play,
  Square,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Check,
  AlertCircle,
  RotateCw,
  FolderSearch,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PLATFORMS_DATA = [
  { id: 'linkedin', name: 'Linkedin', flag: 'use_linkedin', subtitle: 'Professional Network' },
  { id: 'naukri', name: 'Naukri', flag: 'use_naukri', subtitle: 'India Premier Portal' },
  { id: 'indeed', name: 'Indeed', flag: 'use_indeed', subtitle: 'Global Search' },
  { id: 'glassdoor', name: 'Glassdoor', flag: 'use_glassdoor', subtitle: 'Reviews & Jobs' },
  { id: 'internshala', name: 'Internshala', flag: 'use_internshala', subtitle: 'Fresher & Internships' },
  { id: 'shine', name: 'Shine', flag: 'use_shine', subtitle: 'Verified Openings' },
  { id: 'foundit', name: 'Foundit', flag: 'use_foundit', subtitle: 'Monster Network' },
  { id: 'timesjobs', name: 'TimesJobs', flag: 'use_timesjobs', subtitle: 'Corporate Roles' },
  { id: 'wellfound', name: 'Wellfound', flag: 'use_wellfound', subtitle: 'Startup Tech Ecosystem' },
];

export default function DashboardPage() {
  const { config, status, appliedCount, handleStart, handleStop, showToast } = useBot();

  const [appliedJobs, setAppliedJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Collected Jobs State (Found from user inputs)
  const [collectedJobs, setCollectedJobs] = useState([]);
  const [loadingCollected, setLoadingCollected] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [mainTab, setMainTab] = useState('applied'); // 'applied' | 'collected'

  // Filters state (Right side of stats cards)
  const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'today', '7days', '30days'
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all', 'indeed', 'linkedin', etc.
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);
  const platformDropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Close platform dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(e.target)) {
        setIsPlatformDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch real applied jobs from applied_jobs.csv
  useEffect(() => {
    fetchAppliedJobs()
      .then((data) => {
        if (Array.isArray(data)) {
          setAppliedJobs(data);
        }
      })
      .catch((err) => console.error('Failed to load applied jobs:', err))
      .finally(() => setLoadingJobs(false));
  }, [appliedCount]);

  // Fetch collected jobs from collected_jobs.json
  const loadCollected = () => {
    setLoadingCollected(true);
    fetchCollectorJobs()
      .then((data) => {
        if (Array.isArray(data)) {
          setCollectedJobs(data);
        }
      })
      .catch((err) => console.error('Failed to load collected jobs:', err))
      .finally(() => setLoadingCollected(false));
  };

  useEffect(() => {
    loadCollected();
  }, []);

  const handleRunCollector = async () => {
    setCollecting(true);
    try {
      const res = await runJobCollector();
      if (showToast) {
        showToast(`Collected ${res.new_collected || 0} matching jobs (${res.total_in_pool || 0} in pool)`, 'success');
      }
      loadCollected();
    } catch (err) {
      if (showToast) showToast('Failed to collect jobs: ' + err.message, 'error');
    } finally {
      setCollecting(false);
    }
  };

  const isPlatformConnected = (plat) => {
    if (!config) return false;
    return !!config[`connected_${plat.id}`];
  };

  const connectedPlatforms = PLATFORMS_DATA.filter(isPlatformConnected);

  // Format bot uptime
  const formatUptime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Filter recent application records based on right-side filter
  const filteredRecentJobs = appliedJobs.filter((job) => {
    // 1. Platform filter
    if (platformFilter !== 'all') {
      if ((job.platform || '').toLowerCase() !== platformFilter.toLowerCase()) {
        return false;
      }
    }

    // 2. Time range filter
    if (timeFilter !== 'all' && job.date) {
      try {
        const jobDate = new Date(job.date.replace(' ', 'T'));
        const now = new Date();
        if (!isNaN(jobDate.getTime())) {
          const diffDays = (now - jobDate) / (1000 * 60 * 60 * 24);
          if (timeFilter === 'today' && diffDays > 1) return false;
          if (timeFilter === '7days' && diffDays > 7) return false;
          if (timeFilter === '30days' && diffDays > 30) return false;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCompany = job.company?.toLowerCase().includes(q);
      const matchRole = job.job_title?.toLowerCase().includes(q);
      if (!matchCompany && !matchRole) return false;
    }

    return true;
  });

  // Top 5 recent jobs from application log (newest first)
  const topRecentJobs = [...filteredRecentJobs].reverse().slice(0, 5);

  // Count genuinely submitted/applied applications
  const genuinelyAppliedCount = appliedJobs.filter((job) => {
    const s = (job.status || '').toLowerCase();
    return s === 'applied' || s === 'interview' || s === 'interview scheduled' || s === 'assessment (oa)' || s === 'under review' || s === 'offer';
  }).length;

  // Real data: strictly separated between Collected Jobs (pool) & Applied Jobs (submitted)
  const filteredCollected = collectedJobs.filter((job) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = (job.company || '').toLowerCase().includes(q);
      const matchTitle = (job.job_title || job.title || '').toLowerCase().includes(q);
      const matchLoc = (job.location || '').toLowerCase().includes(q);
      if (!matchComp && !matchTitle && !matchLoc) return false;
    }
    return true;
  });

  // 12-hour converter for scheduled time
  const format12h = (timeStr) => {
    if (!timeStr) return '09:30 AM';
    const [h, m] = timeStr.split(':');
    const hInt = parseInt(h, 10) || 0;
    const period = hInt >= 12 ? 'PM' : 'AM';
    const hour12 = hInt % 12 === 0 ? 12 : hInt % 12;
    return `${hour12}:${String(m || '00').padStart(2, '0')} ${period}`;
  };

  const isScheduled = !!config?.scheduler_enabled;
  const rawScheduledTime = (config?.scheduled_times && config.scheduled_times[0]) || '09:30';
  const formattedScheduledTime = format12h(rawScheduledTime);

  // Enabled platforms in user config (e.g. use_naukri, use_indeed)
  const enabledPlatforms = PLATFORMS_DATA.filter((p) => config && !!config[p.flag]);
  const availableFilterPlatforms = enabledPlatforms.length > 0 ? enabledPlatforms : PLATFORMS_DATA;

  // Total collected jobs: count all unique jobs discovered across appliedJobs (CSV) & collectedJobs (JSON) & status.progress
  const allCollectedJobIds = new Set();
  appliedJobs.forEach((j) => {
    const id = j.job_id || j.url || `${j.job_title}-${j.company}`;
    if (id) allCollectedJobIds.add(id);
  });
  collectedJobs.forEach((j) => {
    const id = j.job_id || j.url || `${j.job_title}-${j.company}`;
    if (id) allCollectedJobIds.add(id);
  });
  const totalCollectedCount = Math.max(
    allCollectedJobIds.size,
    appliedJobs.length,
    collectedJobs.length,
    status.progress?.jobs_collected || 0
  );

  return (
    <div className="space-y-3.5 w-full max-w-full pb-1">
      {/* ── Top Section: Sleek Compact Header + Filters (Matched with Platforms & All Pages) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              System Overview & Application Metrics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Two-stage pipeline: Collects matching jobs based on your criteria, then applies autonomously.
            </p>
          </div>
        </div>

        {/* Right Side Filters: Time Period & Portal Filter */}
        <div className="flex items-center gap-2.5 shrink-0">
          <CustomSelect
            value={timeFilter}
            onChange={(val) => setTimeFilter(val)}
            icon={Calendar}
            options={[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: '7days', label: 'Last 7 Days' },
              { value: '30days', label: 'Last 30 Days' },
            ]}
          />

          {/* Custom Styled Portal Dropdown Filter */}
          <div className="relative" ref={platformDropdownRef}>
            <button
              type="button"
              onClick={() => setIsPlatformDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[6px] px-3 py-1.5 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 select-none"
            >
              {platformFilter === 'all' ? (
                <Globe2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              ) : (
                <PlatformLogo id={platformFilter} className="w-4 h-4 rounded-[3px] shrink-0" />
              )}
              <span>
                {platformFilter === 'all'
                  ? 'All Portals'
                  : PLATFORMS_DATA.find((p) => p.id === platformFilter)?.name || platformFilter}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  isPlatformDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

              {isPlatformDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[8px] shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {/* Option: All Portals */}
                  <button
                    type="button"
                    onClick={() => {
                      setPlatformFilter('all');
                      setIsPlatformDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer ${
                      platformFilter === 'all'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>All Portals</span>
                    </div>
                    {platformFilter === 'all' && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                    )}
                  </button>

                  {/* Only Enabled Platforms from Config */}
                  {availableFilterPlatforms.map((plat) => {
                    const isSelected = platformFilter === plat.id;
                    return (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => {
                          setPlatformFilter(plat.id);
                          setIsPlatformDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer ${
                          isSelected
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PlatformLogo id={plat.id} className="w-4 h-4 rounded-[3px] shrink-0" />
                          <span>{plat.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3 Stats Cards: Compact Height ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Jobs Collected */}
          <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Jobs Collected
              </span>
              <div className="w-7 h-7 rounded-[5px] bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight font-mono leading-none">
                {totalCollectedCount.toLocaleString()}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span>Total Discovered Jobs</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Ready to Apply
              </span>
            </div>
          </div>

          {/* Card 2: Jobs Applied */}
          <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Jobs Applied
              </span>
              <div className="w-7 h-7 rounded-[5px] bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Send className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight font-mono leading-none">
                {genuinelyAppliedCount.toLocaleString()}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="capitalize">{timeFilter === 'all' ? 'All recorded' : timeFilter}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Submitted in applied_jobs.csv
              </span>
            </div>
          </div>

          {/* Card 3: Status & Scheduled Apply Time */}
          <div
            onClick={() => setIsScheduleModalOpen(true)}
            className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Status
              </span>
              <div
                className={`w-7 h-7 rounded-[5px] flex items-center justify-center transition ${
                  status.running
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : isScheduled
                    ? 'bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
                title="Click to view or edit scheduled time"
              >
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className={`w-4 h-4 ${isScheduled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <div
                  className={`font-extrabold tracking-tight font-mono leading-none ${
                    isScheduled
                      ? 'text-xl text-slate-900 dark:text-white'
                      : 'text-base text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {status.running ? 'Running Now' : isScheduled ? formattedScheduledTime : 'Not Scheduled'}
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] border ${
                  status.running
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : isScheduled
                    ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {status.running ? 'Running' : isScheduled ? 'Daily Scheduled' : 'Disabled'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span>{isScheduled ? 'Scheduled Apply Time' : 'Scheduler Paused'}</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                {status.running
                  ? `Running (PID ${status.pid})`
                  : isScheduled
                  ? 'Change Schedule →'
                  : 'Set Schedule →'}
              </span>
            </div>
          </div>
        </div>

      {/* ── Main Content: Compact Recent Applications Table (Top 5 Recent Jobs) ── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-xs">
        <div>
          {/* Header: Title on Left + All Logs Link on Right */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  Recent Application Records
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Audit log of recent applications across active portals ({filteredRecentJobs.length} recorded).
                </p>
              </div>
            </div>

            <Link
              to="/history"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 px-2.5 py-1 rounded-[5px] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0"
            >
              All Logs →
            </Link>
          </div>

          {/* Table */}
          {loadingJobs ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading application records...</div>
          ) : topRecentJobs.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-[8px] bg-slate-50/50 dark:bg-slate-900/50 my-1">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">No applications recorded yet</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-0.5">
                  Connect your portals and run the bot. Applications collected and submitted across connected platforms will appear here live.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-800/40">
                    <th className="py-2 px-3 w-[40%]">Role & Company</th>
                    <th className="py-2 px-3 w-[20%]">Platform</th>
                    <th className="py-2 px-3 w-[20%]">Date</th>
                    <th className="py-2 px-3 w-[15%]">Status</th>
                    <th className="py-2 px-3 w-[5%] text-right">Listing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {topRecentJobs.map((job, idx) => {
                    const platId = (job.platform || 'indeed').toLowerCase();
                    const statusStr = (job.status || 'Not Applied').trim();
                    const isApplied = statusStr.toLowerCase() === 'applied';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[320px]" title={job.job_title}>
                            {job.job_title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[320px] mt-0.5" title={job.company}>
                            {job.company}
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <PlatformLogo id={platId} className="w-4 h-4 shrink-0 rounded-[3px]" />
                            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize text-xs">
                              {job.platform}
                            </span>
                          </div>
                        </td>

                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {job.date || '—'}
                        </td>

                        <td className="py-2 px-3">
                          {isApplied ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                              Applied
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {statusStr || 'Not Applied'}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right">
                          {job.url ? (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center w-6 h-6 rounded-[4px] text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-500/30 transition"
                              title="Open Job Posting"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredRecentJobs.length > 5 && (
          <div className="pt-2 mt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Showing top 5 recent jobs ({filteredRecentJobs.length} total recorded)</span>
            <Link to="/history" className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              View all in Applications Log →
            </Link>
          </div>
        )}
      </div>

      {/* Clock Time Picker Modal */}
      <ScheduleWatchModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />
    </div>
  );
}
