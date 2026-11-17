import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBot } from '../../context/BotContext';
import {
  fetchSchedulerStatus,
  runSchedulerNow,
  testEmailSettings,
} from '../../services/api';
import {
  Clock,
  Mail,
  Send,
  Play,
  CheckCircle2,
  AlertTriangle,
  Save,
  BellRing,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Activity,
  Layers,
  Calendar,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import ConnectGmailModal from '../../components/common/ConnectGmailModal';
import ScheduleWatchModal from '../../components/common/ScheduleWatchModal';
import CalendarModal from '../../components/common/CalendarModal';
import MiniCalendar from '../../components/common/MiniCalendar';
import ScallopBadge from '../../components/common/ScallopBadge';

const TIME_PRESETS = [
  { label: '09:30 AM', time24: '09:30', name: 'Morning' },
  { label: '01:00 PM', time24: '13:00', name: 'Afternoon' },
  { label: '05:30 PM', time24: '17:30', name: 'Evening' },
  { label: '09:00 PM', time24: '21:00', name: 'Night' },
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

export default function SchedulerPage() {
  const {
    config,
    updateConfigValue,
    handleSaveConfig,
    showToast,
    checkProfileCompleteness,
    totalJobsCount,
    appliedCount,
  } = useBot();
  const [schedulerStatus, setSchedulerStatus] = useState({
    active: false,
    last_run_date: null,
    last_run_time: null,
    last_run_status: 'Idle',
    current_step: 0,
    step_description: 'Idle',
  });
  const [testingEmail, setTestingEmail] = useState(false);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [editingWatchTime, setEditingWatchTime] = useState(null);
  const [editingTimeKey, setEditingTimeKey] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showAddCustomTime, setShowAddCustomTime] = useState(false);
  const [editingTaskNameKey, setEditingTaskNameKey] = useState(null);
  const [editingTaskNameValue, setEditingTaskNameValue] = useState('');

  const parseTimeTo24h = (str) => {
    if (!str) return null;
    const s = str.trim();
    const match = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3] ? match[3].toLowerCase() : null;
    if (m < 0 || m > 59) return null;
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    if (h < 0 || h > 23) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const loadStatus = async () => {
    try {
      const data = await fetchSchedulerStatus();
      setSchedulerStatus(data);
    } catch (err) {
      console.error('Failed to load scheduler status:', err);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!config) {
    return <div className="text-slate-500 text-xs py-8 text-center">Loading scheduler configuration</div>;
  }

  // 12-hour converter
  const format12h = (timeStr) => {
    if (!timeStr) return '09:30 AM';
    const [h, m] = timeStr.split(':');
    const hInt = parseInt(h, 10) || 0;
    const period = hInt >= 12 ? 'PM' : 'AM';
    const hour12 = hInt % 12 === 0 ? 12 : hInt % 12;
    return `${hour12}:${String(m || '00').padStart(2, '0')} ${period}`;
  };

  const scheduledTimes = Array.isArray(config.scheduled_times) && config.scheduled_times.length > 0
    ? config.scheduled_times
    : ['09:30'];

  const primaryTimeStr = scheduledTimes[0] || '09:30';
  const primaryTimeFormatted = format12h(primaryTimeStr);
  const unappliedQueueCount = Math.max(0, (totalJobsCount || 0) - (appliedCount || 0));

  const activeDays = Array.isArray(config.scheduler_days) && config.scheduler_days.length > 0
    ? config.scheduler_days
    : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const frequencyMode = config.scheduler_mode || (
    activeDays.length === 7 ? 'everyday' :
    (activeDays.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => activeDays.includes(d))) ? 'weekdays' :
    activeDays.length === 1 ? 'onetime' : 'custom'
  );

  const isOneTime = frequencyMode === 'onetime';
  const isEveryDay = frequencyMode === 'everyday';
  const isWeekdaysOnly = frequencyMode === 'weekdays';

  const handleSetFrequency = (mode) => {
    if (mode === 'onetime') {
      const todayDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
      const todayDate = new Date().toISOString().split('T')[0];
      const targetDate = (!config.scheduler_date || config.scheduler_date < todayDate) ? todayDate : config.scheduler_date;
      updateConfigValue('scheduler_mode', 'onetime');
      updateConfigValue('scheduler_days', [todayDay]);
      updateConfigValue('scheduler_date', targetDate);
      handleSaveConfig({
        ...config,
        scheduler_mode: 'onetime',
        scheduler_days: [todayDay],
        scheduler_date: targetDate,
      });
      setIsCalendarModalOpen(true);
    } else if (mode === 'everyday') {
      updateConfigValue('scheduler_mode', 'everyday');
      updateConfigValue('scheduler_days', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
      handleSaveConfig({
        ...config,
        scheduler_mode: 'everyday',
        scheduler_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      });
      showToast('Scheduled to run every day (7 days/week)', 'info');
    } else if (mode === 'weekdays') {
      updateConfigValue('scheduler_mode', 'weekdays');
      updateConfigValue('scheduler_days', ['mon', 'tue', 'wed', 'thu', 'fri']);
      handleSaveConfig({
        ...config,
        scheduler_mode: 'weekdays',
        scheduler_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      });
      showToast('Scheduled to run on weekdays only (Mon-Fri)', 'info');
    }
  };

  const handleToggleDay = (dayId) => {
    if (frequencyMode === 'onetime') {
      updateConfigValue('scheduler_days', [dayId]);
      return;
    }
    const exists = activeDays.includes(dayId);
    let next;
    if (exists) {
      if (activeDays.length === 1) {
        showToast('At least one day must be selected', 'warning');
        return;
      }
      next = activeDays.filter((d) => d !== dayId);
    } else {
      next = [...activeDays, dayId];
    }
    updateConfigValue('scheduler_days', next);
    if (next.length === 7) {
      updateConfigValue('scheduler_mode', 'everyday');
    } else if (next.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => next.includes(d))) {
      updateConfigValue('scheduler_mode', 'weekdays');
    } else {
      updateConfigValue('scheduler_mode', 'custom');
    }
  };

  const handleCalendarDateSelect = (dateStr) => {
    const dObj = new Date(dateStr);
    const dayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dObj.getDay()];
    handleSaveConfig({
      ...config,
      scheduler_mode: 'onetime',
      scheduler_date: dateStr,
      scheduler_days: [dayCode],
    });
    const formatted = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    showToast(`One-time schedule set for ${formatted}`, 'success');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const rawDateStr = config.scheduler_date || todayStr;
  const selectedDateStr = rawDateStr < todayStr ? todayStr : rawDateStr;
  const selectedDateObj = new Date(selectedDateStr.includes('T') ? selectedDateStr : selectedDateStr + 'T00:00:00');
  const formattedSelectedDate = !isNaN(selectedDateObj.getTime())
    ? selectedDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : selectedDateStr;

  const handleAddPresetTime = async (time24) => {
    if (scheduledTimes.includes(time24)) {
      showToast(`${format12h(time24)} is already scheduled`, 'info');
      return;
    }
    const next = [...scheduledTimes, time24].sort();
    updateConfigValue('scheduled_times', next);
    updateConfigValue('scheduler_enabled', true);
    try {
      await handleSaveConfig({ ...config, scheduled_times: next, scheduler_enabled: true }, true);
      showToast(`Added ${format12h(time24)} to daily schedule`, 'success');
    } catch (e) {
      showToast('Failed to save schedule time', 'error');
    }
  };

  const handleRemoveTime = async (time24) => {
    if (scheduledTimes.length <= 1) {
      showToast('At least one schedule time is required', 'warning');
      return;
    }
    const next = scheduledTimes.filter((t) => t !== time24);
    updateConfigValue('scheduled_times', next);
    try {
      await handleSaveConfig({ ...config, scheduled_times: next, scheduler_enabled: true }, true);
      showToast(`Removed ${format12h(time24)} from schedule`, 'info');
    } catch (e) {
      showToast('Failed to save schedule time', 'error');
    }
  };

  const handleSaveFromWatchModal = async (newTime24, enableScheduler = true) => {
    let updatedTimes;
    if (editingWatchTime) {
      updatedTimes = scheduledTimes.map((t) => (t === editingWatchTime ? newTime24 : t));
      updatedTimes = Array.from(new Set(updatedTimes)).sort();
    } else {
      updatedTimes = Array.from(new Set([...scheduledTimes, newTime24])).sort();
    }
    updateConfigValue('scheduled_times', updatedTimes);
    updateConfigValue('scheduler_enabled', true);

    try {
      await handleSaveConfig({
        ...config,
        scheduled_times: updatedTimes,
        scheduler_enabled: true,
      }, true);
      showToast(`Scheduled time updated to ${format12h(newTime24)}`, 'success');
    } catch (e) {
      showToast('Failed to save scheduled time', 'error');
    }
  };

  const handleAddCustomTimeSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!customTimeInput || !customTimeInput.trim()) {
      setShowAddCustomTime(false);
      return;
    }
    const parsed = parseTimeTo24h(customTimeInput);
    if (!parsed) {
      showToast('Please enter a valid time (e.g. 02:30 PM or 14:30)', 'error');
      return;
    }
    if (scheduledTimes.includes(parsed)) {
      showToast(`${format12h(parsed)} is already in your schedule`, 'info');
      return;
    }
    const next = [...scheduledTimes, parsed].sort();
    updateConfigValue('scheduled_times', next);
    updateConfigValue('scheduler_enabled', true);
    setCustomTimeInput('');
    setShowAddCustomTime(false);
    try {
      await handleSaveConfig({ ...config, scheduled_times: next, scheduler_enabled: true }, true);
      showToast(`Added ${format12h(parsed)} to daily schedule`, 'success');
    } catch (e) {
      showToast('Failed to save schedule time', 'error');
    }
  };

  const handleSaveInlineEdit = async (originalTime24) => {
    if (!editingTimeValue || !editingTimeValue.trim()) {
      setEditingTimeKey(null);
      return;
    }
    const parsed = parseTimeTo24h(editingTimeValue);
    if (!parsed) {
      showToast('Please enter a valid time (e.g. 02:30 PM or 14:30)', 'error');
      setEditingTimeKey(null);
      return;
    }
    if (parsed === originalTime24) {
      setEditingTimeKey(null);
      return;
    }
    if (scheduledTimes.includes(parsed)) {
      showToast(`${format12h(parsed)} is already in your schedule`, 'info');
      setEditingTimeKey(null);
      return;
    }
    const next = scheduledTimes.map((t) => (t === originalTime24 ? parsed : t)).sort();
    updateConfigValue('scheduled_times', next);
    updateConfigValue('scheduler_enabled', true);
    setEditingTimeKey(null);
    try {
      await handleSaveConfig({ ...config, scheduled_times: next, scheduler_enabled: true }, true);
      showToast(`Updated schedule to ${format12h(parsed)}`, 'success');
    } catch (e) {
      showToast('Failed to save schedule time', 'error');
    }
  };

  const handleSaveTaskName = async (t) => {
    const currentNames = config.task_names || {};
    const val = editingTaskNameValue.trim() || 'Name';
    const updated = { ...currentNames, [t]: val };
    updateConfigValue('task_names', updated);
    setEditingTaskNameKey(null);
    try {
      await handleSaveConfig({ ...config, task_names: updated }, true);
      showToast(`Task renamed to "${val}"`, 'success');
    } catch (e) {
      showToast('Failed to save task name', 'error');
    }
  };

  const handleTestEmail = async () => {
    const user = config.smtp_user;
    const pass = config.smtp_password;
    const recipient = config.recipient_email || user;

    if (!user || !pass) {
      showToast('Please connect your Gmail account or provide SMTP credentials first', 'error');
      return;
    }

    setTestingEmail(true);
    try {
      const res = await testEmailSettings({
        to_email: recipient,
        smtp_host: config.smtp_host || 'smtp.gmail.com',
        smtp_port: parseInt(config.smtp_port, 10) || 587,
        smtp_user: user,
        smtp_password: pass,
        smtp_use_tls: true,
      });
      showToast(res.message || 'Verification test email dispatched successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'SMTP Authentication failed. Verify your Gmail App Password.', 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleRunPipelineNow = async () => {
    const doApply = config.automate_apply !== false;
    if (doApply && checkProfileCompleteness) {
      const check = checkProfileCompleteness();
      if (!check.complete) {
        showToast(check.reason, 'error');
        return;
      }
    }
    setRunningPipeline(true);
    try {
      await runSchedulerNow();
      showToast('Scheduled pipeline executed based on your automation choices', 'success');
      loadStatus();
    } catch (err) {
      showToast(err.message || 'Failed to run pipeline', 'error');
    } finally {
      setRunningPipeline(false);
    }
  };

  const onSave = async () => {
    const sName = (config.schedule_name || config.task_name || '').trim();
    if (!sName) {
      showToast('Schedule Name is a mandatory field. Please enter a name.', 'error');
      return;
    }
    setSaving(true);
    try {
      updateConfigValue('scheduler_enabled', true);
      await handleSaveConfig({ ...config, schedule_name: sName, task_name: sName, scheduler_enabled: true }, true);
      showToast('Scheduler configuration saved successfully', 'success');
    } finally {
      setSaving(false);
    }
  };

  const pipelineStages = [
    { num: 1, title: 'Job Discovery', desc: 'Crawls matching job targets & ATS postings' },
    { num: 2, title: 'Auto-Apply', desc: 'Fills forms & submits verified resume' },
    { num: 3, title: 'Inbox Scan', desc: 'Detects interview invites & OA recruiter replies' },
    { num: 4, title: 'Daily Digest', desc: 'Dispatches summary email of today applications' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between gap-3 w-full max-w-full pb-0.5">
      {/* ── Top Header - Identical to all pages ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Daily Autonomous Scheduler & Pipeline
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hands-free daily automation: Collects jobs, auto-applies verified resumes, and executes autonomous workflows on schedule.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRunPipelineNow}
            disabled={runningPipeline}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Play className={`w-3.5 h-3.5 fill-white ${runningPipeline ? 'animate-spin' : ''}`} />
            <span>{runningPipeline ? 'Executing Pipeline' : 'Run Pipeline Now'}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* ── 3 Top Status Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Scheduler Daemon with In-Card Toggle */}
        <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3 px-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Scheduler Daemon
            </span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle scheduler on/off">
              <input
                type="checkbox"
                checked={!!config.scheduler_enabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  updateConfigValue('scheduler_enabled', val);
                  await handleSaveConfig({ ...config, scheduler_enabled: val }, true);
                }}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative shadow-inner ${
                  config.scheduler_enabled ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ backgroundColor: config.scheduler_enabled ? '#16a34a' : undefined }}
              >
                <div
                  className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md ${
                    config.scheduler_enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'
                  }`}
                />
              </div>
            </label>
          </div>

          <div className="my-1.5">
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>{config.scheduler_enabled ? 'Active' : 'Paused'}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                  config.scheduler_enabled
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {config.scheduler_enabled ? 'Daemon Running' : 'Standby'}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>Background Service</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {config.scheduler_enabled ? 'Wakes daily on schedule' : 'Click switch to enable'}
            </span>
          </div>
        </div>

        {/* Card 2: Scheduled Times Overview */}
        <div
          onClick={() => setIsScheduleModalOpen(true)}
          className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3 px-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group"
          title="Click to launch interactive clock dial"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Scheduled Apply Time
            </span>
            <div className="w-7 h-7 rounded-[5px] bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/25 transition">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1.5 flex items-center justify-between gap-2">
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight leading-none flex items-center gap-2">
              <span>{config.scheduler_enabled ? primaryTimeFormatted : 'Not Scheduled'}</span>
              {scheduledTimes.length > 1 && config.scheduler_enabled && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  (+{scheduledTimes.length - 1} more)
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
              Change Time &rarr;
            </span>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>
              {isEveryDay ? 'Daily (7 days)' : isWeekdaysOnly ? 'Weekdays (Mon-Fri)' : `${activeDays.length} days/week`}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Interactive Dial Available
            </span>
          </div>
        </div>

        {/* Card 3: Last Run & Status */}
        <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3 px-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Last Execution
            </span>
            <div className="w-7 h-7 rounded-[5px] bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1.5">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none truncate">
              {schedulerStatus.last_run_date
                ? `${schedulerStatus.last_run_date} ${schedulerStatus.last_run_time}`
                : 'No runs recorded yet'}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="truncate max-w-[170px]" title={schedulerStatus.last_run_status}>
              {schedulerStatus.last_run_status || 'Idle'}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              {schedulerStatus.active ? 'Running' : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Schedule Section ── */}
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
          {/* Left Column: Automation Schedule & Routine */}
          <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Daily Routine & Execution Schedule
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                {scheduledTimes.length} Run{scheduledTimes.length > 1 ? 's' : ''} Configured
              </span>
            </div>

            {/* Schedule Name Input Field - Mandate Field */}
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Schedule Name</span>
                  <span className="text-rose-500 font-bold">*</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Mandatory)</span>
                </label>
                {(!config.schedule_name || !config.schedule_name.trim()) && (
                  <span className="text-[10px] font-medium text-amber-500">
                    Required field
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={config.schedule_name || config.task_name || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateConfigValue('schedule_name', val);
                  updateConfigValue('task_name', val);
                }}
                placeholder="e.g. Daily Pipeline"
                className={`w-full h-8 px-2.5 rounded-[5px] bg-slate-50 dark:bg-slate-800/80 border text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-medium transition focus:outline-none ${
                  !config.schedule_name || !config.schedule_name.trim()
                    ? 'border-amber-400/80 dark:border-amber-500/60 focus:border-amber-500'
                    : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Schedule Frequency / Days of the Week */}
            <div className="space-y-2 mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Active Days
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleSetFrequency('onetime');
                      setIsCalendarModalOpen(true);
                    }}
                    className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-semibold border transition cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-semibold border transition cursor-pointer ${
                      isEveryDay
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    All 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetFrequency('weekdays')}
                    className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-semibold border transition cursor-pointer ${
                      isWeekdaysOnly
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Weekdays Only
                  </button>
                </div>
              </div>

              {/* Content dynamically changes according to One time | All 7 Days | Weekdays Only */}
              {isOneTime ? (
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(true)}
                  className="w-full h-9 flex items-center justify-between px-3 bg-blue-50/80 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/40 rounded-[6px] hover:border-blue-500 transition cursor-pointer text-xs group"
                  title="Click to open calendar and change execution date"
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
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1">
                    Change Date &rarr;
                  </span>
                </button>
              ) : isWeekdaysOnly ? (
                <div className="grid grid-cols-5 gap-1.5">
                  {DAYS_OF_WEEK.slice(0, 5).map((d) => {
                    const isSelected = activeDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleToggleDay(d.id)}
                        className={`py-1.5 rounded-[5px] text-xs font-bold text-center border transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500/50 text-blue-700 dark:text-blue-400'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                        }`}
                        title={d.full}
                      >
                        <div>{d.full}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = activeDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleToggleDay(d.id)}
                        className={`py-1.5 rounded-[5px] text-xs font-bold text-center border transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500/50 text-blue-700 dark:text-blue-400'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300'
                        }`}
                        title={d.full}
                      >
                        <div>{d.label}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Schedule Summary Description */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isOneTime ? (
                  <span>One-time run scheduled for {formattedSelectedDate} at {scheduledTimes.map(format12h).join(', ')}</span>
                ) : isEveryDay ? (
                  <span>Repeats daily (Monday to Sunday) at {scheduledTimes.map(format12h).join(', ')}</span>
                ) : isWeekdaysOnly ? (
                  <span>Repeats Monday through Friday at {scheduledTimes.map(format12h).join(', ')}</span>
                ) : (
                  <span>Runs on {activeDays.map((d) => d.toUpperCase()).join(', ')} at {scheduledTimes.map(format12h).join(', ')}</span>
                )}
              </div>
            </div>

            {/* Scheduled Times as Interactive Badges */}
            <div className="space-y-2 mt-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Scheduled Execution Times
              </span>

              {/* List of Scheduled Times */}
              <div className="flex flex-wrap gap-2 items-center">
                {scheduledTimes.map((t) => {
                  const isEditingThis = editingTimeKey === t;
                  return (
                    <div
                      key={t}
                      style={{ height: '30px', minHeight: '30px', maxHeight: '30px', borderRadius: '4px', boxSizing: 'border-box' }}
                      className={`inline-flex items-center gap-2 px-3 text-xs font-bold shadow-2xs transition ${
                        isEditingThis
                          ? 'bg-white dark:bg-slate-900 border border-blue-500 text-slate-900 dark:text-slate-100'
                          : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWatchTime(t);
                          setIsScheduleModalOpen(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer p-0 shrink-0 flex items-center justify-center hover:scale-110"
                        title="Open Clock Dial"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>

                      {isEditingThis ? (
                        <input
                          type="text"
                          value={editingTimeValue}
                          onChange={(e) => setEditingTimeValue(e.target.value)}
                          onBlur={() => handleSaveInlineEdit(t)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineEdit(t);
                            if (e.key === 'Escape') setEditingTimeKey(null);
                          }}
                          placeholder="12:30 AM"
                          style={{ width: '64px', height: '20px' }}
                          className="bg-transparent text-center font-bold text-xs text-slate-900 dark:text-slate-100 focus:outline-none p-0 border-0 leading-none select-all"
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingTimeKey(t);
                            setEditingTimeValue(format12h(t));
                          }}
                          style={{ width: '64px' }}
                          className="text-center leading-none cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition select-none"
                          title="Click to edit time"
                        >
                          {format12h(t)}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveTime(t)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer ml-0.5 flex items-center justify-center p-0 shrink-0"
                        title={`Remove ${format12h(t)}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Add Custom Time Trigger */}
                {!showAddCustomTime ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomTime(true);
                      setCustomTimeInput('');
                    }}
                    style={{ height: '30px', minHeight: '30px', maxHeight: '30px', borderRadius: '4px', boxSizing: 'border-box' }}
                    className="inline-flex items-center gap-1.5 px-3 border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span className="leading-none">Add Time</span>
                  </button>
                ) : (
                  <div
                    style={{ height: '30px', minHeight: '30px', maxHeight: '30px', borderRadius: '4px', boxSizing: 'border-box' }}
                    className="inline-flex items-center gap-2 px-3 bg-white dark:bg-slate-900 border border-blue-500 text-xs font-bold shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWatchTime(null);
                        setIsScheduleModalOpen(true);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 transition cursor-pointer p-0 shrink-0"
                      title="Pick via Clock Dial"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={customTimeInput}
                      onChange={(e) => setCustomTimeInput(e.target.value)}
                      onBlur={() => {
                        if (customTimeInput.trim()) {
                          handleAddCustomTimeSubmit();
                        } else {
                          setShowAddCustomTime(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCustomTimeSubmit(e);
                        if (e.key === 'Escape') {
                          setShowAddCustomTime(false);
                          setCustomTimeInput('');
                        }
                      }}
                      placeholder="02:30 PM"
                      style={{ width: '64px', height: '20px' }}
                      className="bg-transparent text-center font-bold text-xs text-slate-900 dark:text-slate-100 focus:outline-none p-0 border-0 leading-none placeholder-slate-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCustomTime(false);
                        setCustomTimeInput('');
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer p-0 shrink-0"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Stage Automated Pipeline Visualizer & Stage Controls */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Autonomous Pipeline Actions
                </span>
                <span className="text-[10px] text-slate-400">
                  Automate both or select individual stages based on your workflow
                </span>
              </div>
              <span className="text-[10.5px] font-semibold text-blue-600 dark:text-blue-400">
                {config.automate_discovery !== false && config.automate_apply !== false
                  ? 'All Stages Enabled'
                  : config.automate_discovery !== false
                  ? 'Discovery Only'
                  : config.automate_apply !== false
                  ? 'Auto-Apply Only'
                  : 'All Stages Paused'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Stage 1: Job Discovery (Toggleable) */}
              <div
                className={`p-2.5 rounded-[6px] border transition flex items-center justify-between gap-2.5 ${
                  config.automate_discovery !== false
                    ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/10'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
                      config.automate_discovery !== false
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    1
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                      Job Discovery
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Crawls matching job targets & ATS postings
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle Job Discovery">
                  <input
                    type="checkbox"
                    checked={config.automate_discovery !== false}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      updateConfigValue('automate_discovery', val);
                      await handleSaveConfig({ ...config, automate_discovery: val }, true);
                      showToast(val ? 'Job Discovery enabled in pipeline' : 'Job Discovery disabled in pipeline', 'info');
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4.5 rounded-full transition-colors duration-200 relative shadow-inner ${
                      config.automate_discovery !== false ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{ backgroundColor: config.automate_discovery !== false ? '#16a34a' : undefined }}
                  >
                    <div
                      className={`absolute top-[1.5px] w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                        config.automate_discovery !== false ? 'translate-x-[15px]' : 'translate-x-[1.5px]'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Stage 2: Auto-Apply (Toggleable - Work for collected jobs) */}
              <div
                className={`p-2.5 rounded-[6px] border transition flex items-center justify-between gap-2.5 ${
                  config.automate_apply !== false
                    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 ${
                      config.automate_apply !== false
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}
                  >
                    2
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                      Auto-Apply
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Work for collected jobs & submit resume
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Toggle Auto-Apply">
                  <input
                    type="checkbox"
                    checked={config.automate_apply !== false}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      updateConfigValue('automate_apply', val);
                      await handleSaveConfig({ ...config, automate_apply: val }, true);
                      showToast(val ? 'Auto-Apply enabled in pipeline' : 'Auto-Apply disabled in pipeline', 'info');
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4.5 rounded-full transition-colors duration-200 relative shadow-inner ${
                      config.automate_apply !== false ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{ backgroundColor: config.automate_apply !== false ? '#16a34a' : undefined }}
                  >
                    <div
                      className={`absolute top-[1.5px] w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                        config.automate_apply !== false ? 'translate-x-[15px]' : 'translate-x-[1.5px]'
                      }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scheduled Task Details & Execution Queue */}
        <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Scheduled Tasks & Execution Queue ({scheduledTimes.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Daemon: Every 20s</span>
              <span
                className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold border ${
                  config.scheduler_enabled !== false
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {config.scheduler_enabled !== false ? 'Daemon Active' : 'Daemon Paused'}
              </span>
            </div>
          </div>

          {/* List of Scheduled Cards — Rendered dynamically per scheduled time */}
          <div className="space-y-2.5">
            {scheduledTimes.length === 0 ? (
              <div className="p-4 rounded-[8px] border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No scheduled execution times configured. Add a time on the left to queue runs.
              </div>
            ) : (
              scheduledTimes.map((t) => {
                const scheduleTitle = (config.schedule_name || config.task_name || '').trim() || 'Daily Pipeline';
                const isDiscoveryOn = config.automate_discovery !== false;
                const isApplyOn = config.automate_apply !== false;

                return (
                  <div
                    key={t}
                    className="p-3.5 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 transition hover:border-blue-400 dark:hover:border-blue-500/40 shadow-xs space-y-2"
                  >
                    {/* Top Row: Schedule Name | 🕒 9:40 PM + [Active Pipeline Actions Only] + Delete Button */}
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          {scheduleTitle}
                        </span>
                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 select-none">
                          |
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWatchTime(t);
                            setIsScheduleModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          title="Click to change execution time"
                        >
                          <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>{format12h(t)}</span>
                        </button>
                      </div>

                      {/* Autonomous Pipeline Actions — ONLY show what is active/in use */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isDiscoveryOn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                              ✓ 1. Job Discovery
                            </span>
                          )}
                          {isApplyOn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                              ✓ 2. Auto-Apply
                            </span>
                          )}
                          {!isDiscoveryOn && !isApplyOn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                              No Actions Enabled
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveTime(t)}
                          className="w-7 h-7 rounded-[5px] border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                          title={`Delete scheduled run at ${format12h(t)}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subtitle with Frequency */}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isOneTime
                        ? `One-Time execution set for ${formattedSelectedDate}`
                        : isEveryDay
                        ? 'Daily routine set for Monday to Sunday'
                        : isWeekdaysOnly
                        ? 'Weekdays routine set for Monday to Friday'
                        : `Runs on ${activeDays.map((d) => d.toUpperCase()).join(', ')}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Connect Gmail Modal */}
      <ConnectGmailModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        onConnected={() => loadStatus()}
      />

      {/* Interactive Clock Dial Schedule Modal */}
      <ScheduleWatchModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setEditingWatchTime(null);
        }}
        initialTime={editingWatchTime}
        onSaveTime={handleSaveFromWatchModal}
      />

      {/* Calendar Modal for One-Time Execution */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        selectedDate={config.scheduler_date || new Date().toISOString().split('T')[0]}
        onSelectDate={handleCalendarDateSelect}
      />
    </div>
  );
}
