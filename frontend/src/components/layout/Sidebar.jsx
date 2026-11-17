import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import logoLight from '../../assets/logo-light.png';
import logoDark from '../../assets/logo-dark.png';
import {
  LayoutDashboard,
  Globe2,
  Crosshair,
  Compass,
  MailCheck,
  FileSpreadsheet,
  Clock,
  Sparkles,
  UserCheck,
  Settings,
  Bot,
  Play,
  Square,
  Pause,
} from 'lucide-react';
import { useBot } from '../../context/BotContext';
import { fetchResponseMetrics } from '../../services/api';

export default function Sidebar() {
  const { status, handleStart, handleStop, appliedCount, totalJobsCount, theme } = useBot();
  const [positiveCount, setPositiveCount] = useState(0);

  const isDarkTheme = theme === 'dark' || theme === 'indigo';

  useEffect(() => {
    fetchResponseMetrics()
      .then((m) => {
        if (m && m.positive) setPositiveCount(m.positive);
      })
      .catch(() => {});
  }, [appliedCount, totalJobsCount]);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/platforms', label: 'Platforms (10)', icon: Globe2 },
    { to: '/targets', label: 'Job Targets', icon: Crosshair },
    { to: '/history', label: 'Applications Log', icon: FileSpreadsheet, badge: totalJobsCount > 0 ? totalJobsCount : null },
    { to: '/scheduler', label: 'Scheduler & Pipeline', icon: Clock },
    { to: '/email-ai', label: 'AI & Recruiter Inbox', icon: Sparkles },
    { to: '/profile', label: 'Profile & Resume', icon: UserCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-30 select-none shadow-xs">
      {/* Brand Header with Uploaded Logo (Transparent, Theme-Adaptive, No v2.0 badge) */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800">
        <NavLink to="/" className="flex items-center">
          <img
            src={logoLight}
            alt="8Oapply Logo"
            className={`h-7 w-auto object-contain max-w-[145px] ${isDarkTheme ? 'hidden' : 'block'}`}
          />
          <img
            src={logoDark}
            alt="8Oapply Logo"
            className={`h-7 w-auto object-contain max-w-[145px] ${isDarkTheme ? 'block' : 'hidden'}`}
          />
        </NavLink>
      </div>

      {/* Runner Status Control Card (Matching User's Sleek Design) */}
      <div className="mx-3 my-3">
        {status.running ? (
          <div className="relative p-[1px] rounded-[6px] overflow-hidden shadow-sm">
            {/* Ultra-thin 4-color moving circulating gradient border */}
            <div
              className="absolute -inset-[150%] animate-border-circulate"
              style={{
                background:
                  'conic-gradient(from 0deg, #10b981, #06b6d4, #8b5cf6, #f43f5e, #10b981)',
              }}
            />

            {/* Inner Dark Card */}
            <div className="relative rounded-[5px] bg-[#0c1322] p-3 z-10">
              <div className="flex items-center justify-between gap-2.5">
                {/* Left Area: Status, Progress text and /150 */}
                <div className="flex-1 min-w-0">
                  {/* Top: Runner Active (Dot removed) */}
                  <h4 className="text-[13px] font-bold text-white tracking-tight">
                    Runner Active
                  </h4>

                  {/* Middle row: Progress (%) on left, combo/collection counter on right */}
                  <div className="flex items-center justify-between mt-1.5 pr-1">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Progress ({status.progress?.percent ?? 0}%)
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono font-medium" title="Search Targets: (Job Titles × Locations)">
                      {(() => {
                        const total =
                          status.progress?.combo_total > 0
                            ? status.progress.combo_total
                            : config?.job_titles?.length && config?.locations?.length
                            ? config.job_titles.length * config.locations.length
                            : 4;
                        const current = status.progress?.combo_current || 0;
                        return `${current}/${total} Combos`;
                      })()}
                    </span>
                  </div>

                  {/* Bottom: Progress Bar */}
                  <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      style={{
                        width: `${Math.min(100, Math.max(0, status.progress?.percent || 0))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Right: Circular Red Pause/Stop Button */}
                <button
                  onClick={handleStop}
                  title="Stop Engine"
                  style={{ borderRadius: '50%' }}
                  className="btn-circle w-10 h-10 aspect-square bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
                >
                  <Pause className="w-4 h-4 fill-white text-white" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[6px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 shadow-xs">
            <div className="flex items-center justify-between gap-2.5">
              {/* Left Area: Idle info (Dot removed) */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white tracking-tight">
                  Runner Idle
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
                  Standby / Ready
                </p>
              </div>

              {/* Right: Circular Blue Play/Start Button */}
              <button
                onClick={handleStart}
                title="Start Engine"
                style={{ borderRadius: '50%' }}
                className="btn-circle w-10 h-10 aspect-square bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-sm cursor-pointer shrink-0"
              >
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 mb-0.5">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900 dark:text-white stroke-[2.2]' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-xs font-mono font-medium text-slate-400">
                      ({item.badge})
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Technical Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex justify-between">
          <span className="font-medium">Engine:</span>
          <span className="text-slate-700 dark:text-slate-300 font-mono font-semibold">Selenium 4.x</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-medium">Theme:</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold capitalize">
            {theme === 'dark' ? 'Midnight Dark' : theme === 'indigo' ? 'Deep Ocean Indigo' : 'Clean Slate Light'}
          </span>
        </div>
      </div>
    </aside>
  );
}
