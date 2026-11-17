import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAppliedJobs,
  autoUpdateJobStatuses,
  fetchGmailStatus,
  updateJobStatus,
  applyJobLive,
  deleteJob,
  bulkDeleteJobs,
  bulkUpdateJobStatus,
} from '../../services/api';
import { useBot } from '../../context/BotContext';
import PlatformLogo from '../../components/common/PlatformLogo';
import ConnectGmailModal from '../../components/common/ConnectGmailModal';
import ScheduleWatchModal from '../../components/common/ScheduleWatchModal';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
  Play,
  Square,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  Zap,
  Mail,
  Trash2,
  Send,
  Check,
  X,
  Loader2,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react';

export default function HistoryPage() {
  const { status, handleStart, handleStop, showToast, config, checkProfileCompleteness } = useBot();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: '' });
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState(null);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = recent first, 'asc' = older first
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    title: '',
    message: '',
    onConfirm: null,
  });
  const pageSize = 15;

  const isAlreadyApplied = (status) => {
    const s = (status || '').toLowerCase().trim();
    return s !== '' && s !== 'not applied';
  };

  const unappliedSelectedIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const job = jobs.find((j) => j.job_id === id);
      return job && !isAlreadyApplied(job.status);
    });
  }, [selectedIds, jobs]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await fetchAppliedJobs();
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGmail = async () => {
    try {
      const res = await fetchGmailStatus();
      setGmailStatus(res);
    } catch (err) {
      console.error('Failed to fetch Gmail status:', err);
    }
  };

  const handleAutoUpdate = async (silent = false) => {
    setSyncingStatus(true);
    try {
      const res = await autoUpdateJobStatuses();
      await loadJobs();
      if (!silent && showToast) {
        if (res.updated_count > 0) {
          showToast(`Auto-updated ${res.updated_count} application status(es) from recruiter responses!`, 'success');
        } else {
          showToast('Status Tracking is up to date with your recruiter inbox.', 'info');
        }
      }
    } catch (err) {
      if (!silent && showToast) showToast('Auto-update check completed', 'info');
    } finally {
      setSyncingStatus(false);
    }
  };

  const handleToggleSelect = (jobId) => {
    setSelectedIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleToggleSelectAll = () => {
    const pageJobIds = paginatedJobs.map((j) => j.job_id).filter(Boolean);
    const allSelectedOnPage = pageJobIds.length > 0 && pageJobIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageJobIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageJobIds])));
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await updateJobStatus(jobId, newStatus);
      setJobs((prev) =>
        prev.map((j) => (j.job_id === jobId ? { ...j, status: newStatus } : j))
      );
      if (showToast) showToast(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      if (showToast) showToast('Failed to update status', 'error');
    }
  };

  const handleSingleApply = async (job) => {
    if (!job || !job.job_id) return;
    if (isAlreadyApplied(job.status)) {
      if (showToast) showToast(`Job has already been applied to (${job.status}). Duplicate applications are blocked.`, 'info');
      return;
    }
    if (applyingJobId) return;

    if (checkProfileCompleteness) {
      const check = checkProfileCompleteness();
      if (!check.complete) {
        if (showToast) showToast(check.reason, 'error');
        return;
      }
    }

    setApplyingJobId(job.job_id);
    if (showToast) showToast(`Applying to ${job.job_title || 'job'} on ${job.platform || 'portal'}...`, 'info');

    try {
      const res = await applyJobLive(job.job_id);
      if (res && res.status === 'already_applied') {
        if (showToast) showToast(res.message || 'Job was already applied to. Duplicate prevented.', 'info');
        await loadJobs();
        return;
      }
      // Immediately reflect Applied in UI
      setJobs((prev) =>
        prev.map((j) => (j.job_id === job.job_id ? { ...j, status: 'Applied' } : j))
      );
      await updateJobStatus(job.job_id, 'Applied');
      if (showToast) {
        showToast(res.message || `Successfully applied to ${job.job_title || 'job'}!`, 'success');
      }
      await loadJobs();
    } catch (err) {
      if (showToast) showToast(`Apply error: ${err.message}`, 'error');
    } finally {
      setApplyingJobId(null);
    }
  };

  const executeSingleDelete = async (jobId) => {
    setActionLoading(true);
    try {
      await deleteJob(jobId);
      setSelectedIds((prev) => prev.filter((id) => id !== jobId));
      if (showToast) showToast('Job deleted from log', 'info');
      await loadJobs();
    } catch (err) {
      if (showToast) showToast('Failed to delete job', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const executeBulkApply = async (targetIds = unappliedSelectedIds) => {
    if (targetIds.length === 0) return;
    setActionLoading(true);
    try {
      await bulkUpdateJobStatus(targetIds, 'Applied');
      if (showToast) showToast(`Marked ${targetIds.length} unapplied job(s) as Applied!`, 'success');
      setSelectedIds([]);
      await loadJobs();
    } catch (err) {
      if (showToast) showToast('Failed to update selected jobs', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await bulkDeleteJobs(selectedIds);
      if (showToast) showToast(`Deleted ${selectedIds.length} job(s)`, 'info');
      setSelectedIds([]);
      await loadJobs();
    } catch (err) {
      if (showToast) showToast('Failed to delete selected jobs', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleDelete = (job) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Confirm Delete',
      message: `Do you want to delete "${job.job_title || 'this job'}" from application records?`,
      onConfirm: () => executeSingleDelete(job.job_id),
    });
  };

  const handleBulkApply = () => {
    if (unappliedSelectedIds.length === 0) {
      if (showToast) showToast('All selected jobs have already been applied to. Duplicate apply is blocked.', 'info');
      return;
    }
    const alreadyAppliedCount = selectedIds.length - unappliedSelectedIds.length;
    setConfirmModal({
      isOpen: true,
      type: 'apply',
      title: 'Confirm Bulk Apply',
      message:
        alreadyAppliedCount > 0
          ? `Do you want to mark ${unappliedSelectedIds.length} job(s) as Applied? (${alreadyAppliedCount} already-applied job(s) will be automatically skipped to prevent duplicates).`
          : `Do you want to mark ${unappliedSelectedIds.length} selected job(s) as Applied?`,
      onConfirm: () => executeBulkApply(unappliedSelectedIds),
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Confirm Bulk Delete',
      message: `Do you want to delete ${selectedIds.length} selected job record(s)? This action cannot be undone.`,
      onConfirm: () => executeBulkDelete(),
    });
  };

  useEffect(() => {
    loadJobs();
    loadGmail();
    handleAutoUpdate(true);
  }, []);

  // Auto-refresh applications log while bot is running
  useEffect(() => {
    if (!status.running) return;
    const interval = setInterval(() => {
      fetchAppliedJobs()
        .then((data) => {
          if (data) setJobs(data);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [status.running]);

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'Under Review':
        return 'text-amber-500 dark:text-amber-400 font-semibold';
      case 'Assessment (OA)':
        return 'text-cyan-500 dark:text-cyan-400 font-semibold';
      case 'Interview':
      case 'Interview Scheduled':
        return 'text-purple-500 dark:text-purple-400 font-semibold';
      case 'Offer':
        return 'text-emerald-500 dark:text-emerald-300 font-bold';
      case 'Rejected':
        return 'text-rose-500 dark:text-rose-400 font-semibold';
      case 'Applied':
        return 'text-emerald-600 dark:text-emerald-400 font-semibold';
      case 'Not Applied':
      default:
        return 'text-neutral-400 dark:text-neutral-400 font-medium';
    }
  };

  const platformCounts = useMemo(() => {
    const counts = {};
    jobs.forEach((j) => {
      const p = j.platform || 'Unknown';
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [jobs]);

  const statusCounts = useMemo(() => {
    const counts = {};
    jobs.forEach((j) => {
      const s = j.status || 'Not Applied';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [jobs]);

  const platformsList = useMemo(() => {
    return Array.from(new Set(jobs.map((j) => j.platform).filter(Boolean)));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yYear = yDate.getFullYear();
    const yMonth = String(yDate.getMonth() + 1).padStart(2, '0');
    const yDay = String(yDate.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const d7Year = d7.getFullYear();
    const d7Month = String(d7.getMonth() + 1).padStart(2, '0');
    const d7Day = String(d7.getDate()).padStart(2, '0');
    const d7Str = `${d7Year}-${d7Month}-${d7Day}`;

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30Year = d30.getFullYear();
    const d30Month = String(d30.getMonth() + 1).padStart(2, '0');
    const d30Day = String(d30.getDate()).padStart(2, '0');
    const d30Str = `${d30Year}-${d30Month}-${d30Day}`;

    return jobs.filter((job) => {
      const matchesSearch =
        !search ||
        (job.job_title && job.job_title.toLowerCase().includes(search.toLowerCase())) ||
        (job.company && job.company.toLowerCase().includes(search.toLowerCase())) ||
        (job.job_id && job.job_id.toLowerCase().includes(search.toLowerCase()));

      const matchesPlatform = platformFilter === 'ALL' || job.platform === platformFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'Not Applied'
          ? !job.status || job.status === 'Not Applied'
          : job.status === statusFilter);

      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const jobDateStr = (job.date || '').trim().split(' ')[0].split('T')[0];
        if (!jobDateStr) {
          matchesDate = false;
        } else if (dateFilter === 'TODAY') {
          matchesDate = jobDateStr === todayStr;
        } else if (dateFilter === 'YESTERDAY') {
          matchesDate = jobDateStr === yesterdayStr;
        } else if (dateFilter === 'LAST_7_DAYS') {
          matchesDate = jobDateStr >= d7Str && jobDateStr <= todayStr;
        } else if (dateFilter === 'LAST_30_DAYS') {
          matchesDate = jobDateStr >= d30Str && jobDateStr <= todayStr;
        } else if (dateFilter === 'CUSTOM') {
          if (customStartDate && jobDateStr < customStartDate) matchesDate = false;
          if (customEndDate && jobDateStr > customEndDate) matchesDate = false;
        }
      }

      return matchesSearch && matchesPlatform && matchesStatus && matchesDate;
    });
  }, [jobs, search, platformFilter, statusFilter, dateFilter, customStartDate, customEndDate]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const dateA = (a.date || '').trim();
      const dateB = (b.date || '').trim();
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      const cmp = dateA.localeCompare(dateB);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredJobs, sortOrder]);

  const totalPages = Math.ceil(sortedJobs.length / pageSize) || 1;
  const paginatedJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);

  const isScheduled = !!config?.scheduler_enabled;
  const rawScheduledTime = (config?.scheduled_times && config.scheduled_times[0]) || '09:30';

  const format12h = (timeStr) => {
    if (!timeStr) return '09:30 AM';
    const [h, m] = timeStr.split(':');
    const hInt = parseInt(h, 10) || 0;
    const mInt = parseInt(m, 10) || 0;
    const p = hInt >= 12 ? 'PM' : 'AM';
    const h12 = hInt % 12 === 0 ? 12 : hInt % 12;
    return `${String(h12).padStart(2, '0')}:${String(mInt).padStart(2, '0')} ${p}`;
  };

  const formattedScheduledTime = format12h(rawScheduledTime);

  const exportCSV = () => {
    if (jobs.length === 0) return;
    const headers = ['date', 'platform', 'job_title', 'company', 'job_id', 'url'];
    const rows = jobs.map((j) =>
      [j.date, j.platform, `"${j.job_title || ''}"`, `"${j.company || ''}"`, j.job_id, j.url].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'applied_jobs_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      {/* Top Header - No Background Card */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 py-1 w-full">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Application Records (applied_jobs.csv)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Audit log of all job applications submitted through 8Oapply runners with live auto-apply & schedule execution.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={exportCSV}
            disabled={jobs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Export CSV
          </button>

          {/* Schedule Auto Apply Action with Watch/Time */}
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border text-xs font-semibold transition cursor-pointer shadow-2xs ${
              isScheduled
                ? 'border-teal-400 bg-teal-50 hover:bg-teal-100 text-teal-800'
                : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Click to view watch dial and set or modify scheduled time"
          >
            <Clock className={`w-3.5 h-3.5 ${isScheduled ? 'text-teal-600' : 'text-slate-600'}`} />
            {isScheduled ? `Scheduled: ${formattedScheduledTime}` : 'Schedule Auto Apply'}
          </button>

          {/* Bulk Actions: Shown only if items selected */}
          {selectedIds.length > 0 && (
            <>
              <button
                disabled={actionLoading || unappliedSelectedIds.length === 0}
                onClick={handleBulkApply}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs select-none"
                title={
                  unappliedSelectedIds.length === 0
                    ? 'All selected jobs are already applied (duplicate apply blocked)'
                    : `Apply to ${unappliedSelectedIds.length} unapplied job(s)${selectedIds.length > unappliedSelectedIds.length ? ` (${selectedIds.length - unappliedSelectedIds.length} already applied skipped)` : ''}`
                }
              >
                <Send className="w-3.5 h-3.5 text-white fill-white shrink-0" />
                <span>Apply</span>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full border-2 border-white text-white font-black text-xs leading-none shrink-0 shadow-2xs">
                  {unappliedSelectedIds.length}
                </span>
              </button>
              <button
                disabled={actionLoading}
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-xs select-none"
                title={`Delete ${selectedIds.length} selected job(s)`}
              >
                <Trash2 className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Delete</span>
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full border-2 border-white text-white font-black text-xs leading-none shrink-0 shadow-2xs">
                  {selectedIds.length}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subtle Gmail Connection Notice if Not Connected */}
      {!gmailStatus?.connected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-[8px] bg-neutral-900 border border-neutral-800 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
              <Mail className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div>
              <span className="font-semibold text-neutral-200">Automatic Status Tracking</span>
              <span className="text-neutral-400 ml-1.5">
                Connect your Gmail so 8Oapply can scan recruiter replies and automatically update your application status (Under Review, Assessment, Interview, Offer, Rejected).
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsGmailModalOpen(true)}
            className="shrink-0 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            Connect Gmail
          </button>
        </div>
      )}

      {/* Filter and Search Bar with Integrated Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 justify-between w-full">
        {/* Left: Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by role, company, or ID..."
            className="w-full pl-8 pr-3 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 placeholder-neutral-500"
          />
        </div>

        {/* Right Area: Date Range, Status & Platform Filters */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Date Range Filter */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-7 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 cursor-pointer"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Range...</option>
            </select>
          </div>

          {/* Custom Date Pickers when CUSTOM is selected */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-300">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 cursor-pointer"
              />
              <span className="text-neutral-500 text-[11px]">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 cursor-pointer"
              />
            </div>
          )}

          {/* Status Filter */}
          <div className="relative">
            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-7 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 cursor-pointer"
            >
              <option value="ALL">All Statuses ({jobs.length})</option>
              <option value="Not Applied">Not Applied ({statusCounts['Not Applied'] || 0})</option>
              <option value="Applied">Applied ({statusCounts['Applied'] || 0})</option>
              <option value="Under Review">Under Review ({statusCounts['Under Review'] || 0})</option>
              <option value="Assessment (OA)">Assessment (OA) ({statusCounts['Assessment (OA)'] || 0})</option>
              <option value="Interview Scheduled">Interview Scheduled ({statusCounts['Interview Scheduled'] || 0})</option>
              <option value="Offer">Offer ({statusCounts['Offer'] || 0})</option>
              <option value="Rejected">Rejected ({statusCounts['Rejected'] || 0})</option>
            </select>
          </div>

          {/* Platform Filter with Platform-Wise Job Counts */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-7 h-[34px] rounded-[6px] bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 cursor-pointer"
            >
              <option value="ALL">All Platforms ({jobs.length})</option>
              {platformsList.map((p) => (
                <option key={p} value={p}>
                  {p} ({platformCounts[p] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Flat Enterprise Table with Live Status Controls */}
      <div className="rounded-[10px] border border-neutral-800 bg-neutral-900 overflow-hidden w-full max-w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-medium select-none">
                <th className="py-2 px-1.5 w-6 text-center select-none">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    title="Select / Deselect All on Page"
                    className={`w-3.5 h-3.5 rounded-[2.5px] border flex items-center justify-center transition cursor-pointer mx-auto ${
                      paginatedJobs.length > 0 && paginatedJobs.every((j) => selectedIds.includes(j.job_id))
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-neutral-800 border-neutral-600 hover:border-neutral-500'
                    }`}
                  >
                    {paginatedJobs.length > 0 && paginatedJobs.every((j) => selectedIds.includes(j.job_id)) && (
                      <Check className="w-2.5 h-2.5 stroke-[3] text-white" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => {
                    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                    setPage(1);
                  }}
                  className="py-2 px-2 whitespace-nowrap cursor-pointer select-none hover:text-neutral-200 transition group"
                  title={
                    sortOrder === 'desc'
                      ? 'Currently sorted by Recent first. Click to sort by Older first.'
                      : 'Currently sorted by Older first. Click to sort by Recent first.'
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span>Timestamp</span>
                    {sortOrder === 'desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                </th>
                <th className="py-2 px-2 whitespace-nowrap">Platform</th>
                <th className="py-2 px-2">Job Title</th>
                <th className="py-2 px-2">Company</th>
                <th className="py-2 px-2 whitespace-nowrap">Status</th>
                <th className="py-2 px-2 whitespace-nowrap">Job Description</th>
                <th className="py-2 px-2 text-center whitespace-nowrap">Listing</th>
                <th className="py-2 px-2 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-500">
                    Querying records...
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-neutral-500">
                    No application records match current query.
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/40 transition">
                    <td className="py-1.5 px-1.5 w-6 text-center select-none">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(job.job_id)}
                        title="Select row"
                        className={`w-3.5 h-3.5 rounded-[2.5px] border flex items-center justify-center transition cursor-pointer mx-auto ${
                          selectedIds.includes(job.job_id)
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-neutral-800 border-neutral-600 hover:border-neutral-500'
                        }`}
                      >
                        {selectedIds.includes(job.job_id) && (
                          <Check className="w-2.5 h-2.5 stroke-[3] text-white" />
                        )}
                      </button>
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap text-neutral-400 font-mono text-[11px]">
                      {job.date || '—'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <PlatformLogo
                          id={(job.platform || 'indeed').toLowerCase()}
                          className="w-3.5 h-3.5 rounded-[1px]"
                          style={{ borderRadius: '1px' }}
                        />
                        <span className="font-semibold text-neutral-200 capitalize text-xs">
                          {job.platform || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 font-medium text-neutral-200 max-w-[180px] truncate" title={job.job_title}>
                      {job.job_title || '—'}
                    </td>
                    <td className="py-1.5 px-2 text-neutral-300 font-medium max-w-[140px] truncate" title={job.company}>
                      {job.company || '—'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span className={`text-xs ${getStatusTextColor(job.status || 'Not Applied')}`}>
                        {job.status || 'Not Applied'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-neutral-400 font-mono text-[11px] max-w-[120px] truncate" title={job.job_id}>
                      {job.job_id || '—'}
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-100 font-medium transition text-xs"
                        >
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2.5 justify-center">
                        {/* Apply icon without bg */}
                        <button
                          disabled={isAlreadyApplied(job.status) || applyingJobId === job.job_id}
                          onClick={() => handleSingleApply(job)}
                          title={isAlreadyApplied(job.status) ? `Already Applied (${job.status}) - Duplicate applications blocked` : 'Apply to this job'}
                          className={`bg-transparent border-0 p-0 transition ${
                            isAlreadyApplied(job.status)
                              ? 'text-neutral-500/30 cursor-not-allowed opacity-30 pointer-events-none'
                              : 'text-emerald-500 hover:text-emerald-600 cursor-pointer disabled:opacity-50'
                          }`}
                        >
                          {applyingJobId === job.job_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {/* Delete icon without bg */}
                        <button
                          onClick={() => handleSingleDelete(job)}
                          title="Delete job record"
                          className="bg-transparent border-0 p-0 text-rose-500 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Flat Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <div>
              Showing {(page - 1) * pageSize + 1} to{' '}
              {Math.min(page * pageSize, sortedJobs.length)} of {sortedJobs.length} records
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 transition cursor-pointer text-neutral-300"
              >
                Previous
              </button>
              <span className="px-2 py-1 font-mono text-neutral-400 text-xs">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 transition cursor-pointer text-neutral-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connect Gmail Modal */}
      <ConnectGmailModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        onConnected={() => {
          loadJobs();
          loadGmail();
        }}
      />

      {/* Schedule Watch Modal */}
      <ScheduleWatchModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Confirmation Modal in Middle */}
      {confirmModal.isOpen && (
        <div
          onClick={() => !actionLoading && setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 text-center flex flex-col items-center animate-in zoom-in-95 duration-150"
          >
            {/* Top Right Close 'X' Button */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-200 transition cursor-pointer p-1 rounded-md hover:bg-neutral-800"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Icon */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-3.5 border ${
                confirmModal.type === 'delete'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {confirmModal.type === 'delete' ? (
                <Trash2 className="w-5 h-5 text-rose-400" />
              ) : (
                <Send className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-neutral-100 mb-2">
              {confirmModal.title}
            </h3>

            {/* Message */}
            <p className="text-xs text-neutral-400 mb-5 px-2 leading-relaxed">
              {confirmModal.message}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2 px-3 rounded-[7px] bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-300 font-medium text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  if (confirmModal.onConfirm) {
                    await confirmModal.onConfirm();
                  }
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-2 px-3 rounded-[7px] text-white font-semibold text-xs transition cursor-pointer shadow-sm disabled:opacity-50 ${
                  confirmModal.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {actionLoading ? 'Processing' : confirmModal.type === 'delete' ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
