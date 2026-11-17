import React, { useState, useEffect } from 'react';
import { Keyboard, Clock, X } from 'lucide-react';
import { useBot } from '../../context/BotContext';

export default function ScheduleWatchModal({ isOpen, onClose, initialTime, onSaveTime }) {
  const { config, handleSaveConfig, showToast } = useBot();

  const [hour12, setHour12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('AM'); // 'AM' | 'PM'
  const [viewMode, setViewMode] = useState('hours'); // 'hours' | 'minutes'
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = initialTime || (config?.scheduled_times && config.scheduled_times[0]) || '09:00';
    const [hStr, mStr] = (raw || '09:00').split(':');
    const h24 = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;

    const p = h24 >= 12 ? 'PM' : 'AM';
    const h = h24 % 12 === 0 ? 12 : h24 % 12;

    setHour12(h);
    setMinute(m);
    setPeriod(p);

    if (isOpen) {
      setViewMode('hours'); // Always start with Hour dial
      setIsKeyboardMode(false);
    }
  }, [config, isOpen, initialTime]);

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

  const initialEnabled = !!config?.scheduler_enabled;

  // Dial Geometry (208x208 compact dial for reduced height)
  const dialSize = 208;
  const center = dialSize / 2;
  const radius = 74;

  // Outer Hours: 12 at top, then 1 to 11
  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // Minutes: 00 to 55 in steps of 5
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const getCoordinates = (index, total = 12) => {
    const angleDeg = (index / total) * 360;
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  // Pointer position calculation
  let pointerTarget;
  if (viewMode === 'hours') {
    const hIndex = hour12 % 12;
    pointerTarget = getCoordinates(hIndex, 12);
  } else {
    const rad = (minute * 6 - 90) * (Math.PI / 180);
    pointerTarget = {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  }

  // Handle Hour Click -> Auto-transitions to Minutes Watch
  const handleHourSelect = (h) => {
    setHour12(h);
    setTimeout(() => {
      setViewMode('minutes');
    }, 180);
  };

  // Handle Minute Click
  const handleMinuteSelect = (m) => {
    setMinute(m);
  };

  // Click on dial surface
  const handleDialClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - center;
    const clickY = e.clientY - rect.top - center;

    let angleDeg = (Math.atan2(clickY, clickX) * 180) / Math.PI + 90;
    if (angleDeg < 0) angleDeg += 360;

    if (viewMode === 'hours') {
      let selectedH = Math.round(angleDeg / 30) % 12;
      if (selectedH === 0) selectedH = 12;
      handleHourSelect(selectedH);
    } else {
      let selectedM = Math.round(angleDeg / 6) % 60;
      handleMinuteSelect(selectedM);
    }
  };

  // Save selection
  const handleSave = async (enableScheduler = true) => {
    let h24 = hour12 % 12;
    if (period === 'PM') h24 += 12;
    const timeStr24 = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const formatted12h = `${hour12}:${String(minute).padStart(2, '0')} ${period}`;

    setSaving(true);
    try {
      if (onSaveTime) {
        await onSaveTime(timeStr24, enableScheduler);
        onClose();
        return;
      }

      let updatedTimes = [timeStr24];
      if (config?.scheduled_times?.length > 1 && initialTime) {
        updatedTimes = config.scheduled_times.map((t) => (t === initialTime ? timeStr24 : t));
        if (!updatedTimes.includes(timeStr24)) updatedTimes.push(timeStr24);
      }

      const newConfig = {
        ...config,
        scheduled_times: updatedTimes,
        scheduler_enabled: enableScheduler,
      };

      await handleSaveConfig(newConfig);
      if (enableScheduler) {
        showToast(`Auto-apply scheduled daily at ${formatted12h}!`, 'success');
      } else {
        showToast('Schedule disabled. Run Auto-Apply is now active.', 'info');
      }
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to update schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
    >
      {/* Compact Main Popup with reduced height and borderless sleek styling */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: '12px' }}
        className="relative w-full max-w-[290px] bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden p-4 select-none animate-in zoom-in-95 duration-150"
      >
        {/* Top Header with Clear Heading */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Schedule Apply Time
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Set daily autonomous execution time
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Large Time Display: Click Hour or Minute to switch dial */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {/* Hour Box */}
          <button
            type="button"
            onClick={() => setViewMode('hours')}
            style={{ borderRadius: '6px' }}
            className={`min-w-[56px] py-1 px-1 text-3xl font-semibold tracking-tight transition cursor-pointer flex items-center justify-center ${
              viewMode === 'hours'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 ring-2 ring-blue-500/30'
                : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
            title="Click to select Hour"
          >
            {hour12}
          </button>

          <span className="text-2xl font-bold text-neutral-400 pb-0.5">:</span>

          {/* Minute Box */}
          <button
            type="button"
            onClick={() => setViewMode('minutes')}
            style={{ borderRadius: '6px' }}
            className={`min-w-[56px] py-1 px-1 text-3xl font-semibold tracking-tight transition cursor-pointer flex items-center justify-center ${
              viewMode === 'minutes'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 ring-2 ring-blue-500/30'
                : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
            }`}
            title="Click to select Minutes"
          >
            {String(minute).padStart(2, '0')}
          </button>

          {/* AM / PM Toggle with crisp reduced border-radius */}
          <div className="flex flex-col gap-1 ml-1">
            <button
              type="button"
              onClick={() => setPeriod('AM')}
              style={{ borderRadius: '3px' }}
              className={`px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                period === 'AM'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => setPeriod('PM')}
              style={{ borderRadius: '3px' }}
              className={`px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
                period === 'PM'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              PM
            </button>
          </div>
        </div>

        {/* Watch Dial (Hours or Minutes mode based on selection) */}
        {!isKeyboardMode ? (
          <div
            onClick={handleDialClick}
            className="relative w-[208px] h-[208px] rounded-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/80 mx-auto cursor-pointer flex items-center justify-center overflow-hidden my-1"
          >
            {/* Center Pointer Dot */}
            <div className="absolute w-2 h-2 rounded-full bg-blue-600 z-20 pointer-events-none" />

            {/* Hand Line & Selector Circle */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox={`0 0 ${dialSize} ${dialSize}`}
            >
              <line
                x1={center}
                y1={center}
                x2={pointerTarget.x}
                y2={pointerTarget.y}
                stroke="#2563EB"
                strokeWidth="2"
              />
              <circle cx={pointerTarget.x} cy={pointerTarget.y} r="14" fill="#2563EB" />
            </svg>

            {/* WATCH 1: HOURS MODE */}
            {viewMode === 'hours' &&
              hoursList.map((h, idx) => {
                const pos = getCoordinates(idx, 12);
                const isSelected = hour12 === h;
                return (
                  <div
                    key={`hour-${h}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHourSelect(h);
                    }}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold z-20 transition-colors ${
                      isSelected
                        ? 'text-white font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:text-blue-500'
                    }`}
                  >
                    {h}
                  </div>
                );
              })}

            {/* WATCH 2: MINUTES MODE */}
            {viewMode === 'minutes' &&
              minutesList.map((m, idx) => {
                const pos = getCoordinates(idx, 12);
                const isSelected = minute === m;
                return (
                  <div
                    key={`min-${m}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMinuteSelect(m);
                    }}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold z-20 transition-colors ${
                      isSelected
                        ? 'text-white font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:text-blue-500'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </div>
                );
              })}
          </div>
        ) : (
          /* Manual Keyboard Input Option */
          <div className="py-5 space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                min="1"
                max="12"
                value={hour12}
                onChange={(e) => setHour12(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-14 p-1.5 rounded-[4px] bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-center text-xl font-semibold"
              />
              <span className="text-xl font-bold">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minute}
                onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-14 p-1.5 rounded-[4px] bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-center text-xl font-semibold"
              />
            </div>
            <p className="text-[11px] text-neutral-400">Enter hour (1-12) and minute (0-59)</p>
          </div>
        )}

        {/* Footer Actions without divider border */}
        <div className="flex items-center justify-between pt-2.5 mt-1">
          <button
            type="button"
            onClick={() => setIsKeyboardMode(!isKeyboardMode)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            title={isKeyboardMode ? 'Switch to watch dial' : 'Switch to keyboard input'}
          >
            {isKeyboardMode ? <Clock className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-1.5">
            {initialEnabled && (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-2 py-1 text-xs text-rose-500 hover:text-rose-600 font-medium transition cursor-pointer"
              >
                Disable
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ borderRadius: '3px' }}
              className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-500/10 transition cursor-pointer"
            >
              Cancel
            </button>
            {/* OK Button with crisp reduced border-radius */}
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              style={{ borderRadius: '3px' }}
              className="px-3.5 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
