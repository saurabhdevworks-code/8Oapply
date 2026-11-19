import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sun, Moon, Palette, Settings, LogOut } from 'lucide-react';
import { useBot } from '../../context/BotContext';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES = {
  '/': 'System Dashboard',
  '/platforms': 'Job Portals & Credentials',
  '/targets': 'Search Targets & Preferences',
  '/responses': 'Recruiter Response & Pipeline Tracker',
  '/history': 'Application Records',
  '/scheduler': 'Daily Scheduler & Email Notifications',
  '/profile': 'Candidate Profile & Documents',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const { theme, applyTheme } = useBot();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const title = PAGE_TITLES[location.pathname] || '8Oapply';

  const cycleTheme = () => {
    if (theme === 'light') applyTheme('dark');
    else if (theme === 'dark') applyTheme('indigo');
    else applyTheme('light');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [dropdownOpen]);

  return (
    <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-20 px-6 flex items-center justify-between shadow-xs w-full max-w-full min-w-0">
      <div>
        <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Standalone Circular Theme Toggle Button (Sized to match inner profile circle: 34px) */}
        <button
          type="button"
          onClick={cycleTheme}
          title={`Active Theme: ${theme === 'dark' ? 'Midnight Dark' : theme === 'indigo' ? 'Deep Ocean Indigo' : 'Clean Slate Light'}. Click to switch.`}
          style={{ borderRadius: '50%' }}
          className="btn-circle w-[34px] h-[34px] aspect-square rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center cursor-pointer shrink-0"
        >
          {theme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-amber-400" />
          ) : theme === 'indigo' ? (
            <Palette className="w-3.5 h-3.5 text-indigo-500" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          )}
        </button>

        {/* Profile Capsule Pill (Guaranteed Fully Rounded Semicircle Left and Right) */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              style={{ borderRadius: '9999px' }}
              className="pill-capsule rounded-full h-11 pl-1.5 pr-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer select-none flex items-center gap-2.5 text-left"
            >
              {/* Concentric Grey Circle Avatar */}
              <div
                style={{ borderRadius: '50%' }}
                className="btn-circle w-[34px] h-[34px] aspect-square rounded-full bg-[#c4c4c4] text-slate-700 flex items-center justify-center font-bold text-xs uppercase tracking-wider shrink-0"
              >
                {user.name ? user.name.slice(0, 2) : (user.email ? user.email.slice(0, 2) : 'U')}
              </div>

              {/* Name & Email Block */}
              <div className="flex flex-col text-left leading-tight min-w-0 pr-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[150px]">
                  {user.name || 'User'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal tracking-tight truncate max-w-[170px]">
                  {user.email}
                </span>
              </div>
            </button>

            {/* Dropdown Menu Card (Settings & Logout) */}
            {dropdownOpen && (
              <div
                style={{ borderRadius: '16px' }}
                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              >
                {/* Settings Link */}
                <Link
                  to="/settings"
                  onClick={() => setDropdownOpen(false)}
                  style={{ borderRadius: '10px' }}
                  className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-700 stroke-[2.2]" />
                  <span>Settings</span>
                </Link>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  style={{ borderRadius: '10px' }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 transition cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4 text-slate-700 stroke-[2.2]" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
