import React, { useState, useEffect, useMemo } from 'react';
import { useBot } from '../../context/BotContext';
import {
  fetchSchedulerStatus,
  runSchedulerNow,
  testEmailSettings,
  applySelectedJobsNow,
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
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import ConnectGmailModal from '../../components/common/ConnectGmailModal';
import ScheduleWatchModal from '../../components/common/ScheduleWatchModal';
import CalendarModal from '../../components/common/CalendarModal';
import ScheduledJobSelectModal from '../../components/common/ScheduledJobSelectModal';

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
  const [isJobSelectModalOpen, setIsJobSelectModalOpen] = useState(false);

  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [editingWatchTime, setEditingWatchTime] = useState(null);
  const [editingTimeKey, setEditingTimeKey] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showAddCustomTime, setShowAddCustomTime] = useState(false);
  const [isEditingTimeInline, setIsEditingTimeInline] = useState(false);
  const [editingTimeInlineValue, setEditingTimeInlineValue] = useState('');

  // Parse time helper
  const format12h = (timeStr) => {
    if (!timeStr) return '09:30 AM';
    const [h, m] = timeStr.split(':');
    const hInt = parseInt(h, 10) || 0;
    const period = hInt >= 12 ? 'PM' : 'AM';
    const hour12 = hInt % 12 === 0 ? 12 : hInt % 12;
    return `${hour12}:${String(m || '00').padStart(2, '0')} ${period}`;
  };

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

  // Multi-schedule list state management (backward-compatible)
  const schedules = useMemo(() => {
    if (!config) return [];
    if (Array.isArray(config.schedules)) {
      return config.schedules;
    }
    // Migration fallback from existing single schedule configuration
    const times = Array.isArray(config.scheduled_times) && config.scheduled_times.length > 0
      ? config.scheduled_times
      : [];
    if (times.length > 0) {
      const baseName = (config.schedule_name || config.task_name || '').trim() || 'Daily Pipeline';
      return times.map((t, idx) => ({
        id: `sched_${idx + 1}`,
        name: times.length === 1 ? baseName : `${baseName} ${idx + 1}`,
        time: t,
        frequency: config.scheduler_mode || 'everyday',
        days: Array.isArray(config.scheduler_days) && config.scheduler_days.length > 0
          ? config.scheduler_days
          : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        date: config.scheduler_date || new Date().toISOString().split('T')[0],
        action_mode: config.scheduler_action_mode || 'fetch_and_apply',
        enabled: true,
        selected_jobs: config.scheduled_selected_jobs || [],
      }));
    }
    return [];
  }, [config]);

  // Active schedule selection
  const activeSchedule = schedules.find((s) => s.id === selectedScheduleId) || schedules[0] || null;
  const activeScheduleId = activeSchedule?.id || null;

  // Persist schedules to backend config
  const persistSchedules = async (nextSchedules, toastMsg = null) => {
    const times = Array.from(new Set(nextSchedules.filter((s) => s.enabled !== false).map((s) => s.time))).sort();
    updateConfigValue('schedules', nextSchedules);
    updateConfigValue('scheduled_times', times);

    const first = nextSchedules[0] || null;
    const payload = {
      ...config,
      schedules: nextSchedules,
      scheduled_times: times,
    };
    if (first) {
      payload.schedule_name = first.name;
      payload.scheduler_action_mode = first.action_mode;
      payload.scheduler_mode = first.frequency;
      payload.scheduler_days = first.days;
      payload.scheduler_date = first.date;
      updateConfigValue('schedule_name', first.name);
      updateConfigValue('scheduler_action_mode', first.action_mode);
      updateConfigValue('scheduler_mode', first.frequency);
      updateConfigValue('scheduler_days', first.days);
      updateConfigValue('scheduler_date', first.date);
    }
    try {
      await handleSaveConfig(payload, true);
      if (toastMsg) showToast(toastMsg, 'success');
    } catch (e) {
      showToast('Failed to save scheduler updates', 'error');
    }
  };

  const handleUpdateActiveSchedule = async (field, value) => {
    if (!activeScheduleId) return;
    const nextSchedules = schedules.map((s) => (s.id === activeScheduleId ? { ...s, [field]: value } : s));
    await persistSchedules(nextSchedules);
  };

  // Create new schedule routine
  const handleCreateNewSchedule = async () => {
    const newId = `sched_${Date.now()}`;
    const newSched = {
      id: newId,
      name: `Scheduled Routine ${schedules.length + 1}`,
      time: '18:00',
      frequency: 'everyday',
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      date: new Date().toISOString().split('T')[0],
      action_mode: 'fetch_and_apply',
      enabled: true,
      selected_jobs: [],
    };
    const nextSchedules = [...schedules, newSched];
    setSelectedScheduleId(newId);
    await persistSchedules(nextSchedules, `New schedule "${newSched.name}" created!`);
  };

  // UNRESTRICTED DELETION: Allows deleting any schedule, even the last one
  const handleDeleteSchedule = async (schedId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const target = schedules.find((s) => s.id === schedId);
    const nextSchedules = schedules.filter((s) => s.id !== schedId);
    if (activeScheduleId === schedId) {
      setSelectedScheduleId(nextSchedules[0]?.id || null);
    }
    await persistSchedules(nextSchedules, `Deleted schedule "${target?.name || 'Routine'}"`);
  };

  // Toggle individual schedule routine active/paused
  const handleToggleScheduleEnabled = async (schedId, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const nextSchedules = schedules.map((s) => (s.id === schedId ? { ...s, enabled: !s.enabled } : s));
    await persistSchedules(nextSchedules);
  };

  const handleSaveJobSelection = async (jobIds) => {
    if (!activeScheduleId) return;
    const nextSchedules = schedules.map((s) => (s.id === activeScheduleId ? { ...s, selected_jobs: jobIds } : s));
    updateConfigValue('scheduled_selected_jobs', jobIds);
    await persistSchedules(nextSchedules, `Saved ${jobIds.length} jobs for scheduled apply!`);
  };

  const handleApplySelectedJobsNow = async (jobIds) => {
    try {
      await applySelectedJobsNow(jobIds);
      showToast(`Started application for ${jobIds.length} selected jobs!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to apply to selected jobs', 'error');
    }
  };

  const handleCalendarDateSelect = (dateStr) => {
    const dObj = new Date(dateStr);
    const dayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dObj.getDay()];
    if (activeSchedule) {
      const nextSchedules = schedules.map((s) =>
        s.id === activeScheduleId
          ? { ...s, frequency: 'onetime', date: dateStr, days: [dayCode] }
          : s
      );
      persistSchedules(nextSchedules);
      const formatted = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      showToast(`One-time run set for ${formatted}`, 'success');
    }
  };

  const handleSaveFromWatchModal = async (newTime24) => {
    if (!activeScheduleId) return;
    const nextSchedules = schedules.map((s) =>
      s.id === activeScheduleId ? { ...s, time: newTime24 } : s
    );
    await persistSchedules(nextSchedules, `Scheduled time updated to ${format12h(newTime24)}`);
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
    setSaving(true);
    try {
      await handleSaveConfig({ ...config, scheduler_enabled: true }, true);
      showToast('Scheduler configuration saved successfully', 'success');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="text-slate-500 text-xs py-8 text-center">Loading scheduler configuration</div>;
  }

  // Active schedule derived helpers
  const currentDays = activeSchedule?.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const currentFrequency = activeSchedule?.frequency || 'everyday';
  const isOneTime = currentFrequency === 'onetime';
  const isEveryDay = currentFrequency === 'everyday';
  const isWeekdaysOnly = currentFrequency === 'weekdays';
  const rawDateStr = activeSchedule?.date || new Date().toISOString().split('T')[0];
  const selectedDateObj = new Date(rawDateStr.includes('T') ? rawDateStr : rawDateStr + 'T00:00:00');
  const formattedSelectedDate = !isNaN(selectedDateObj.getTime())
    ? selectedDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : rawDateStr;

  const enabledSchedules = schedules.filter((s) => s.enabled !== false);
  const primaryTimeStr = enabledSchedules[0]?.time || (schedules[0]?.time ?? null);
  const primaryTimeFormatted = primaryTimeStr ? format12h(primaryTimeStr) : 'Not Scheduled';

  return (
    <div className="space-y-3.5 w-full max-w-full pb-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Daily Autonomous Scheduler & Pipeline
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hands-free automation: Manage multiple independent scheduled routines across your job platforms.
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
        {/* Card 1: Scheduler Daemon */}
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
              <span>{config.scheduler_enabled && enabledSchedules.length > 0 ? 'Active' : 'Paused'}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                  config.scheduler_enabled && enabledSchedules.length > 0
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {config.scheduler_enabled && enabledSchedules.length > 0
                  ? `${enabledSchedules.length} Active Routine${enabledSchedules.length > 1 ? 's' : ''}`
                  : 'Standby'}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>Background Service</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {config.scheduler_enabled ? 'Runs active routines' : 'Click switch to enable'}
            </span>
          </div>
        </div>

        {/* Card 2: Next Scheduled Time */}
        <div
          onClick={() => {
            if (activeSchedule) {
              setEditingWatchTime(activeSchedule.time);
              setIsScheduleModalOpen(true);
            }
          }}
          className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-3 px-3.5 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer group"
          title="Click to launch clock dial"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Primary Apply Time
            </span>
            <div className="w-7 h-7 rounded-[5px] bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/25 transition">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-1.5 flex items-center justify-between gap-2">
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight leading-none flex items-center gap-2">
              <span>{config.scheduler_enabled && schedules.length > 0 ? primaryTimeFormatted : 'Not Scheduled'}</span>
              {schedules.length > 1 && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  (+{schedules.length - 1} more)
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
              Change Time &rarr;
            </span>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>
              {schedules.length} Total Routine{schedules.length !== 1 ? 's' : ''} Configured
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        {/* Left Column: Schedule Routine Editor */}
        <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
          {activeSchedule ? (
            <div>
              {/* Header with Title & Action */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Edit Routine: {activeSchedule.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewSchedule}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 text-[10.5px] font-bold transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Schedule</span>
                </button>
              </div>

              {/* Schedule Name Input */}
              <div className="mt-2.5 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Schedule Name</span>
                </label>
                <input
                  type="text"
                  value={activeSchedule.name}
                  onChange={(e) => handleUpdateActiveSchedule('name', e.target.value)}
                  placeholder="e.g. Morning Discovery, Night Apply"
                  className="w-full h-8 px-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-[6px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Active Days Frequency Selector */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Active Days
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const todayDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
                        const nextSchedules = schedules.map((s) =>
                          s.id === activeScheduleId
                            ? { ...s, frequency: 'onetime', days: [todayDay] }
                            : s
                        );
                        persistSchedules(nextSchedules);
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
                      onClick={() => {
                        const nextSchedules = schedules.map((s) =>
                          s.id === activeScheduleId
                            ? { ...s, frequency: 'everyday', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }
                            : s
                        );
                        persistSchedules(nextSchedules, 'Routine set to run daily');
                      }}
                      className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-semibold border transition cursor-pointer ${
                        isEveryDay
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      All 7 Days
                    </button>

                  </div>
                </div>

                {isOneTime ? (
                  <button
                    type="button"
                    onClick={() => setIsCalendarModalOpen(true)}
                    className="w-full h-9 flex items-center justify-between px-3 bg-blue-50/80 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/40 rounded-[6px] hover:border-blue-500 transition cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Run Date:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{formattedSelectedDate}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                      Change Date &rarr;
                    </span>
                  </button>
                ) : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = currentDays.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            const exists = currentDays.includes(d.id);
                            const next = exists
                              ? currentDays.filter((x) => x !== d.id)
                              : [...currentDays, d.id];
                            handleUpdateActiveSchedule('days', next);
                          }}
                          className={`h-8 rounded-[5px] text-xs font-bold border transition cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                          }`}
                        >
                          <div>{d.label}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Execution Time for This Schedule */}
              <div className="space-y-2 mt-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Scheduled Execution Time
                </span>

                <div className="flex flex-wrap gap-2 items-center">
                  <div
                    style={{ height: '30px', minHeight: '30px', maxHeight: '30px', borderRadius: '4px', boxSizing: 'border-box' }}
                    className="inline-flex items-center gap-2 px-3 text-xs font-bold shadow-2xs transition bg-white dark:bg-slate-900 border border-blue-500 text-slate-900 dark:text-slate-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWatchTime(activeSchedule.time);
                        setIsScheduleModalOpen(true);
                      }}
                      className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/25 transition cursor-pointer p-0 shrink-0"
                      title="Open Clock Dial"
                    >
                      <Clock className="w-3 h-3" />
                    </button>
                    {isEditingTimeInline ? (
                      <input
                        type="text"
                        value={editingTimeInlineValue}
                        onChange={(e) => setEditingTimeInlineValue(e.target.value)}
                        onBlur={() => {
                          const t24 = parseTimeTo24h(editingTimeInlineValue);
                          if (t24) {
                            handleUpdateActiveSchedule('time', t24);
                            showToast(`Time updated to ${format12h(t24)}`, 'success');
                          }
                          setIsEditingTimeInline(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const t24 = parseTimeTo24h(editingTimeInlineValue);
                            if (t24) {
                              handleUpdateActiveSchedule('time', t24);
                              showToast(`Time updated to ${format12h(t24)}`, 'success');
                            }
                            setIsEditingTimeInline(false);
                          } else if (e.key === 'Escape') {
                            setIsEditingTimeInline(false);
                          }
                        }}
                        autoFocus
                        className="w-[68px] text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-blue-500 rounded px-1 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setIsEditingTimeInline(true);
                          setEditingTimeInlineValue(format12h(activeSchedule.time));
                        }}
                        className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        title="Click to edit time directly"
                      >
                        {format12h(activeSchedule.time)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingWatchTime(activeSchedule.time);
                      setIsScheduleModalOpen(true);
                    }}
                    style={{ height: '30px', minHeight: '30px', maxHeight: '30px', borderRadius: '4px', boxSizing: 'border-box' }}
                    className="inline-flex items-center gap-1.5 px-3 border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Change via Dial</span>
                  </button>
                </div>
              </div>

              {/* 3-Mode Unified Scheduler Execution Modes */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 mt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      Scheduler Execution Mode
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Choose what this routine executes at its scheduled time
                    </span>
                  </div>
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
                    {activeSchedule.action_mode === 'selected_jobs'
                      ? 'Mode 3: Apply Selected'
                      : activeSchedule.action_mode === 'collect_only'
                      ? 'Mode 2: Discovery Only'
                      : 'Mode 1: Fetch & Auto-Apply'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Mode 1: Fetch & Auto-Apply */}
                  <div
                    onClick={() => handleUpdateActiveSchedule('action_mode', 'fetch_and_apply')}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2 min-h-[112px] ${
                      (activeSchedule.action_mode || 'fetch_and_apply') === 'fetch_and_apply'
                        ? 'border-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            1
                          </div>
                          <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100">
                            Fetch & Auto-Apply
                          </span>
                        </div>
                        {(activeSchedule.action_mode || 'fetch_and_apply') === 'fetch_and_apply' && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5">
                        Crawl fresh matching jobs from enabled platforms + Auto-apply immediately.
                      </p>
                    </div>
                    <div className="mt-auto pt-1">
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        Full Pipeline Active
                      </span>
                    </div>
                  </div>

                  {/* Mode 2: Discovery Only (Collect) */}
                  <div
                    onClick={() => handleUpdateActiveSchedule('action_mode', 'collect_only')}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2 min-h-[112px] ${
                      activeSchedule.action_mode === 'collect_only'
                        ? 'border-amber-500/80 bg-amber-50/50 dark:bg-amber-500/10 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            2
                          </div>
                          <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100">
                            Discovery Only
                          </span>
                        </div>
                        {activeSchedule.action_mode === 'collect_only' && (
                          <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5">
                        Discover fresh jobs and save to records as "Not Applied" to review before applying.
                      </p>
                    </div>
                    <div className="mt-auto pt-1">
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        Collect Without Applying
                      </span>
                    </div>
                  </div>

                  {/* Mode 3: Apply Selected Jobs */}
                  <div
                    onClick={() => {
                      handleUpdateActiveSchedule('action_mode', 'selected_jobs');
                      setIsJobSelectModalOpen(true);
                    }}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2 min-h-[112px] ${
                      activeSchedule.action_mode === 'selected_jobs'
                        ? 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            3
                          </div>
                          <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100">
                            Apply Selected
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {(activeSchedule.selected_jobs || []).length}
                          </span>
                          {activeSchedule.action_mode === 'selected_jobs' && (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5">
                        Apply only to unapplied jobs selected in your queue.
                      </p>
                    </div>
                    <div className="mt-auto pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateActiveSchedule('action_mode', 'selected_jobs');
                          setIsJobSelectModalOpen(true);
                        }}
                        className="w-full text-[10.5px] font-bold py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Select Jobs ({(activeSchedule.selected_jobs || []).length})</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Routine Actions: Delete Routine */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Editing routine: <strong className="text-slate-700 dark:text-slate-200">{activeSchedule.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSchedule(activeSchedule.id, e)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete This Routine</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No Routine Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Select a routine from the list or create a new scheduler to configure days and times.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateNewSchedule}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Schedule Routine</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Scheduled Tasks & Execution Queue */}
        <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
          {/* Card Header with Add Schedule button */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Scheduled Tasks & Execution Queue ({schedules.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateNewSchedule}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Schedule</span>
              </button>
            </div>
          </div>

          {/* List of Scheduled Routines */}
          <div className="space-y-2.5">
            {schedules.length === 0 ? (
              <div className="p-6 rounded-[8px] border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No scheduled execution routines configured.
                </p>
                <p className="text-[11px] text-slate-400">
                  Click "+ Add Schedule" above to create an automated job routine.
                </p>
              </div>
            ) : (
              schedules.map((sched) => {
                const isSelected = sched.id === activeScheduleId;
                const isSchedOneTime = sched.frequency === 'onetime';
                const isSchedEveryday = sched.frequency === 'everyday';
                const isSchedWeekdays = sched.frequency === 'weekdays';

                return (
                  <div
                    key={sched.id}
                    onClick={() => setSelectedScheduleId(sched.id)}
                    className={`p-3.5 rounded-[8px] border transition cursor-pointer shadow-xs space-y-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-500/10 ring-1 ring-blue-500/40'
                        : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Status dot / checkbox */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleScheduleEnabled(sched.id, e)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition cursor-pointer ${
                            sched.enabled !== false
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                          }`}
                          title={sched.enabled !== false ? 'Routine active (click to pause)' : 'Routine paused (click to activate)'}
                        >
                          {sched.enabled !== false && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>

                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                          {sched.name}
                        </span>
                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 select-none">
                          |
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
                          <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>{format12h(sched.time)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Mode Badge */}
                        {sched.action_mode === 'selected_jobs' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            <Layers className="w-3 h-3" />
                            Mode 3: {(sched.selected_jobs || []).length} Jobs
                          </span>
                        ) : sched.action_mode === 'collect_only' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            <Search className="w-3 h-3" />
                            Mode 2: Discovery
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                            <Sparkles className="w-3 h-3" />
                            Mode 1: Fetch & Apply
                          </span>
                        )}

                        {/* DELETE BUTTON: Free deletion, no restrictions */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSchedule(sched.id, e)}
                          className="w-7 h-7 rounded-[5px] border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer flex items-center justify-center shrink-0 shadow-2xs"
                          title="Delete this schedule routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      <span>
                        {isSchedOneTime
                          ? `One-Time on ${sched.date || 'Scheduled Date'}`
                          : isSchedEveryday
                          ? 'Daily (Monday to Sunday)'
                          : isSchedWeekdays
                          ? 'Weekdays (Monday to Friday)'
                          : `Days: ${(sched.days || []).map((d) => d.toUpperCase()).join(', ')}`}
                      </span>
                      {isSelected ? (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Editing in Form &larr;
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                          Click to edit
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
        selectedDate={activeSchedule?.date || new Date().toISOString().split('T')[0]}
        onSelectDate={handleCalendarDateSelect}
      />

      {/* Mode 2: Scheduled Unapplied Job Selection Modal */}
      <ScheduledJobSelectModal
        isOpen={isJobSelectModalOpen}
        onClose={() => setIsJobSelectModalOpen(false)}
        selectedJobIds={activeSchedule?.selected_jobs || []}
        onSaveSelection={handleSaveJobSelection}
        onApplyNow={handleApplySelectedJobsNow}
      />
    </div>
  );
}
