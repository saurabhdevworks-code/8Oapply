import React, { useState, useEffect } from 'react';
import { useBot } from '../../context/BotContext';
import {
  fetchPlatformStatus,
  openPlatformLoginBrowser,
  verifyPlatformSession,
  checkPlatformLoginStatus,
  disconnectPlatform,
} from '../../services/api';
import ScallopBadge from '../../components/common/ScallopBadge';
import PlatformLogo from '../../components/common/PlatformLogo';
import {
  Globe2,
  Sparkles,
  Check,
  X,
  Loader2,
  ShieldCheck,
  RotateCw,
  AlertCircle,
  Plug,
  Lock,
  ExternalLink,
  LayoutGrid,
  List,
  GripVertical,
} from 'lucide-react';

const PLATFORMS_DATA = [
  {
    id: 'linkedin',
    name: 'Linkedin',
    flag: 'use_linkedin',
    emailKey: 'linkedin_email',
    passKey: 'linkedin_password',
    loginUrl: 'https://www.linkedin.com/login',
    googleAuthUrl: 'https://www.linkedin.com/login',
    subtitle: 'Professional Network',
    desc: 'Automates LinkedIn 1-click Easy Apply workflows with resume.',
  },
  {
    id: 'naukri',
    name: 'Naukri',
    flag: 'use_naukri',
    emailKey: 'naukri_email',
    passKey: 'naukri_password',
    loginUrl: 'https://www.naukri.com/nlogin/login',
    googleAuthUrl: 'https://www.naukri.com/nlogin/login',
    subtitle: 'India Premier Job Portal',
    desc: 'Direct applications on Naukri recruiter listings and custom query forms.',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    flag: 'use_indeed',
    emailKey: 'indeed_email',
    passKey: 'indeed_password',
    loginUrl: 'https://secure.indeed.com/auth',
    googleAuthUrl: 'https://secure.indeed.com/auth',
    subtitle: 'Global Employment Search',
    desc: 'Indeed Apply workflow automation with cover letter injection.',
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    flag: 'use_glassdoor',
    emailKey: 'glassdoor_email',
    passKey: 'glassdoor_password',
    loginUrl: 'https://www.glassdoor.co.in/profile/login_input.htm',
    googleAuthUrl: 'https://www.glassdoor.co.in/profile/login_input.htm',
    subtitle: 'Jobs & Company Reviews',
    desc: 'Glassdoor Easy Apply submissions with salary screening answers.',
  },
  {
    id: 'internshala',
    name: 'Internshala',
    flag: 'use_internshala',
    emailKey: 'internshala_email',
    passKey: 'internshala_password',
    loginUrl: 'https://internshala.com/login/user',
    googleAuthUrl: 'https://internshala.com/login/user',
    subtitle: 'Internships & Fresher Jobs',
    desc: 'Entry-level, graduate, and internship positions across startups.',
  },
  {
    id: 'shine',
    name: 'Shine',
    flag: 'use_shine',
    emailKey: 'shine_email',
    passKey: 'shine_password',
    loginUrl: 'https://www.shine.com/myshine/login/',
    googleAuthUrl: 'https://www.shine.com/myshine/login/',
    subtitle: 'Verified Job Openings',
    desc: 'Automated application submissions for verified roles on Shine.',
  },
  {
    id: 'foundit',
    name: 'Foundit',
    flag: 'use_foundit',
    emailKey: 'foundit_email',
    passKey: 'foundit_password',
    loginUrl: 'https://www.foundit.in/login',
    googleAuthUrl: 'https://www.foundit.in/login',
    subtitle: 'Monster Career Network',
    desc: 'Foundit India portal auto-applier with profile session persistence.',
  },
  {
    id: 'timesjobs',
    name: 'TimesJobs',
    flag: 'use_timesjobs',
    emailKey: 'timesjobs_email',
    passKey: 'timesjobs_password',
    loginUrl: 'https://www.timesjobs.com/candidate/login.html',
    googleAuthUrl: 'https://www.timesjobs.com/candidate/login.html',
    subtitle: 'Corporate Opportunities',
    desc: 'Corporate job postings and verified recruiter applications.',
  },
  {
    id: 'wellfound',
    name: 'Wellfound',
    flag: 'use_wellfound',
    emailKey: 'wellfound_email',
    passKey: 'wellfound_password',
    loginUrl: 'https://wellfound.com/login',
    googleAuthUrl: 'https://wellfound.com/login',
    subtitle: 'Startup Tech Ecosystem',
    desc: 'Startup engineering roles with tailored cover pitch submission.',
  },
  {
    id: 'others',
    name: 'Others',
    flag: 'use_others',
    emailKey: 'others_email',
    passKey: 'others_password',
    loginUrl: 'https://careers.google.com',
    googleAuthUrl: 'https://careers.google.com',
    subtitle: 'Google Search & Career Portals',
    desc: 'Collects jobs across company career pages (Workday, Lever, Greenhouse) via Google with AI screening answers.',
  },
];

export default function PlatformsPage() {
  const { config, handleSaveConfig, showToast, reloadPlatformStatus, reloadConfig, loading } = useBot();
  const safeConfig = config || {};
  const [connectingId, setConnectingId] = useState(null);
  const [credentialsOpenId, setCredentialsOpenId] = useState(null);
  const [credForm, setCredForm] = useState({ email: '', password: '' });
  const [platformStatuses, setPlatformStatuses] = useState({});
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // View Mode: 'grid' (3 columns) or 'list' (compact rows)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('8oapply_platforms_view') || 'grid';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('8oapply_platforms_view', mode);
  };

  // Draggable platform cards ordering
  const [platformsList, setPlatformsList] = useState(() => {
    const savedOrder = localStorage.getItem('8oapply_platforms_order');
    if (savedOrder) {
      try {
        const ids = JSON.parse(savedOrder);
        const map = new Map(PLATFORMS_DATA.map((p) => [p.id, p]));
        const ordered = ids.map((id) => map.get(id)).filter(Boolean);
        PLATFORMS_DATA.forEach((p) => {
          if (!ordered.find((o) => o.id === p.id)) ordered.push(p);
        });
        return ordered;
      } catch (e) {
        // Fallback
      }
    }
    return PLATFORMS_DATA;
  });

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...platformsList];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setPlatformsList(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    const idsOrder = updated.map((p) => p.id);
    localStorage.setItem('8oapply_platforms_order', JSON.stringify(idsOrder));

    const platformPriorityOrder = updated.map((p) => p.flag).filter(Boolean);
    const newConfig = {
      ...config,
      platform_priority: platformPriorityOrder,
    };
    handleSaveConfig(newConfig);

    if (showToast) {
      showToast(`Priority updated: ${movedItem.name} moved to #${targetIndex + 1}`, 'info');
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const loadPlatformStatuses = async () => {
    try {
      setLoadingStatuses(true);
      const res = await fetchPlatformStatus();
      if (res && res.platforms) {
        setPlatformStatuses(res.platforms);
      }
    } catch (err) {
      console.warn('Could not fetch platform statuses:', err);
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    loadPlatformStatuses();
  }, []);

  const isPlatformConnected = (plat) => {
    if (platformStatuses[plat.id] !== undefined) {
      return !!platformStatuses[plat.id].connected;
    }
    return !!safeConfig[`connected_${plat.id}`];
  };

  const handleDisconnect = async (plat) => {
    try {
      await disconnectPlatform(plat.id);
      const newConfig = {
        ...config,
        [`connected_${plat.id}`]: false,
        [`auth_google_${plat.id}`]: false,
        [plat.flag]: false,
      };
      await handleSaveConfig(newConfig);
      await loadPlatformStatuses();
      if (reloadPlatformStatus) await reloadPlatformStatus();
      if (reloadConfig) await reloadConfig();
      if (showToast) {
        showToast(`${plat.name} disconnected`, 'info');
      }
    } catch (err) {
      if (showToast) showToast('Failed to disconnect platform: ' + err.message, 'error');
    }
  };

  const handleConnect = async (plat) => {
    setConnectingId(plat.id);
    try {
      // 1. Launch the automation Chrome window directly so session is saved in the bot profile
      await openPlatformLoginBrowser(plat.id);

      // 2. Mark connected and enabled in config & backend
      const newConfig = {
        ...config,
        [plat.flag]: true,
        [`connected_${plat.id}`]: true,
      };
      await handleSaveConfig(newConfig);
      await loadPlatformStatuses();
      if (reloadPlatformStatus) await reloadPlatformStatus();
      if (reloadConfig) await reloadConfig();
      if (showToast) {
        showToast(`Chrome opened for ${plat.name}. Sign in in that window to connect session!`, 'success');
      }
    } catch (err) {
      if (showToast) showToast('Error connecting: ' + err.message, 'error');
    } finally {
      setConnectingId(null);
    }
  };

  const handleSaveCredentials = async (plat) => {
    if (!credForm.email.trim()) {
      if (showToast) showToast('Please enter an email or username', 'warning');
      return;
    }
    setConnectingId(plat.id);
    try {
      const newConfig = {
        ...config,
        [plat.emailKey]: credForm.email.trim(),
        [plat.passKey]: credForm.password.trim(),
        [plat.flag]: true,
        [`connected_${plat.id}`]: true,
      };
      await handleSaveConfig(newConfig);
      await loadPlatformStatuses();
      if (reloadPlatformStatus) await reloadPlatformStatus();
      if (reloadConfig) await reloadConfig();
      setCredentialsOpenId(null);
      setCredForm({ email: '', password: '' });
      if (showToast) {
        showToast(`${plat.name} credentials saved & platform connected!`, 'success');
      }
    } catch (err) {
      if (showToast) showToast('Failed to save credentials: ' + err.message, 'error');
    } finally {
      setConnectingId(null);
    }
  };

  // Toggle Portal Enable/Disable (Switch) - Locked if not connected
  const handleTogglePlatform = async (plat) => {
    if (!isPlatformConnected(plat)) {
      if (showToast) {
        showToast(`Please connect ${plat.name} first before enabling it`, 'warning');
      }
      handleOpenConnect(plat);
      return;
    }
    const nextVal = !safeConfig[plat.flag];
    const newConfig = {
      ...config,
      [plat.flag]: nextVal,
    };
    await handleSaveConfig(newConfig);
  };

  // Toggle Connection State (Badge)
  const handleToggleConnection = async (plat) => {
    if (!isPlatformConnected(plat)) {
      handleOpenConnect(plat);
    } else {
      await handleDisconnect(plat);
    }
  };

  const connectedCount = PLATFORMS_DATA.filter(isPlatformConnected).length;
  const enabledCount = PLATFORMS_DATA.filter((p) => isPlatformConnected(p) && safeConfig[p.flag]).length;

  return (
    <div className="space-y-4 w-full max-w-full pb-10">
      {/* Top Header - Clean Title with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <Globe2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                Platform Configuration
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ScallopBadge connected={connectedCount > 0} className="w-3 h-3" />
                {connectedCount} of {PLATFORMS_DATA.length} Connected
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                ({enabledCount} Enabled)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click Connect, log in once in the open Chrome window, and sessions are saved permanently
            </p>
          </div>
        </div>

        {/* Right side: View Switcher (Grid vs List) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-[6px] border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              title="Grid View (3 Columns)"
              className={`px-2.5 py-1 rounded-[5px] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              title="List View (Compact Rows)"
              className={`px-2.5 py-1 rounded-[5px] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List of Platform Cards (Draggable reordering enabled) */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {platformsList.map((plat, idx) => {
            const isEnabled = !!safeConfig[plat.flag];
            const isConnected = isPlatformConnected(plat);

            return (
              <div
                key={plat.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white dark:bg-[#111827] rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between cursor-default ${
                  draggedIndex === idx ? 'opacity-40 scale-[0.98] ring-2 ring-blue-500' : ''
                } ${dragOverIndex === idx ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/25' : ''}`}
              >
                <div>
                  {/* Top Row: Drag Handle + Official Logo + Title with Scallop Badge + Toggle Switch */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        title="Drag to reorder"
                        className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300 p-0.5 select-none shrink-0"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                      <PlatformLogo id={plat.id} className="w-9 h-9 rounded-[3px] shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                            {plat.name}
                          </h3>
                          {/* Scalloped Badge: Solid Filled Green if connected */}
                          <button
                            type="button"
                            onClick={() => handleToggleConnection(plat)}
                            className="cursor-pointer transition hover:scale-110 active:scale-95 focus:outline-hidden"
                            title={
                              isConnected
                                ? `${plat.name} is connected. Click to disconnect.`
                                : `${plat.name} is not connected. Click to connect.`
                            }
                          >
                            <ScallopBadge connected={isConnected} className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                          {plat.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Enable / Disable Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      disabled={!isConnected}
                      onClick={() => handleTogglePlatform(plat)}
                      title={
                        !isConnected
                          ? `Connect ${plat.name} first to enable`
                          : isEnabled
                          ? `Disable ${plat.name}`
                          : `Enable ${plat.name}`
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                        isEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Platform Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3.5">
                    {plat.desc}
                  </p>
                </div>

                {/* Bottom Row: Connect Button & Inline Credentials */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  {isConnected ? (
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Connected & Verified</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(plat.loginUrl, '_blank')}
                          className="p-1.5 rounded-[6px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          title="Open Login Tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnect(plat)}
                          className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer font-medium"
                          title="Disconnect"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : credentialsOpenId === plat.id ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span>Enter {plat.name} Credentials</span>
                        <button
                          type="button"
                          onClick={() => setCredentialsOpenId(null)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Email or Username"
                        value={credForm.email}
                        onChange={(e) => setCredForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full text-xs px-2.5 py-1.5 rounded-[6px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-blue-500"
                      />
                      <input
                        type="password"
                        placeholder="Password"
                        value={credForm.password}
                        onChange={(e) => setCredForm((prev) => ({ ...prev, password: e.target.value }))}
                        className="w-full text-xs px-2.5 py-1.5 rounded-[6px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-blue-500"
                      />
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleSaveCredentials(plat)}
                          disabled={connectingId === plat.id}
                          className="flex-1 py-1.5 px-3 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                        >
                          {connectingId === plat.id ? 'Saving...' : 'Save & Connect'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCredentialsOpenId(null)}
                          className="py-1.5 px-2.5 rounded-[6px] border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleConnect(plat)}
                        disabled={connectingId === plat.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-98 disabled:opacity-50"
                      >
                        {connectingId === plat.id ? (
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                        ) : (
                          <Globe2 className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>Connect {plat.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCredentialsOpenId(plat.id);
                          setCredForm({
                            email: safeConfig[plat.emailKey] || '',
                            password: safeConfig[plat.passKey] || '',
                          });
                        }}
                        className="px-2.5 py-2 rounded-[6px] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium transition cursor-pointer"
                        title="Enter email & password"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View (Compact Rows) */
        <div className="space-y-2">
          {platformsList.map((plat, idx) => {
            const isEnabled = !!safeConfig[plat.flag];
            const isConnected = isPlatformConnected(plat);

            return (
              <div
                key={plat.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white dark:bg-[#111827] rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-3 sm:px-4 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  draggedIndex === idx ? 'opacity-40 scale-[0.99] ring-2 ring-blue-500' : ''
                } ${dragOverIndex === idx ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/25' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    title="Drag to reorder"
                    className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 p-0.5 select-none shrink-0"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <PlatformLogo id={plat.id} className="w-7 h-7 rounded-[3px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {plat.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleToggleConnection(plat)}
                        className="cursor-pointer transition hover:scale-110 active:scale-95 focus:outline-hidden shrink-0"
                      >
                        <ScallopBadge connected={isConnected} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {plat.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    disabled={!isConnected}
                    onClick={() => handleTogglePlatform(plat)}
                    title={
                      !isConnected
                        ? `Connect ${plat.name} first`
                        : isEnabled
                        ? `Disable ${plat.name}`
                        : `Enable ${plat.name}`
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                      isEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mr-2">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Connected & Verified</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => window.open(plat.loginUrl, '_blank')}
                        className="p-1.5 rounded-[6px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="Open Login Tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(plat)}
                        className="px-2.5 py-1 rounded-[6px] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 text-xs font-semibold transition cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConnect(plat)}
                      disabled={connectingId === plat.id}
                      className="px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {connectingId === plat.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      ) : (
                        <Globe2 className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>
  );
}