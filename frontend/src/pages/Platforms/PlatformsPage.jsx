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

function GoogleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

const PLATFORMS_DATA = [
  {
    id: 'linkedin',
    name: 'Linkedin',
    flag: 'use_linkedin',
    emailKey: 'linkedin_email',
    passKey: 'linkedin_password',
    loginUrl: 'https://www.linkedin.com/login',
    googleAuthUrl: 'https://www.linkedin.com/uas/login?email=&oauth_provider=google',
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
    loginUrl: 'https://internshala.com/login/student',
    googleAuthUrl: 'https://internshala.com/login/student',
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
  const { config, handleSaveConfig, showToast } = useBot();
  const [activePlat, setActivePlat] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg] = useState(null);
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
    e.dataTransfer.setData('text/plain', index.toString());
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
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...platformsList];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setPlatformsList(updated);
    localStorage.setItem('8oapply_platforms_order', JSON.stringify(updated.map((p) => p.id)));
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (showToast) {
      showToast('Portal layout updated', 'info');
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const loadPlatformStatuses = async () => {
    setLoadingStatuses(true);
    try {
      const data = await fetchPlatformStatus();
      if (data?.platforms) {
        setPlatformStatuses(data.platforms);
      }
    } catch (err) {
      console.warn('Could not load live platform statuses:', err);
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    loadPlatformStatuses();
  }, []);

  // Auto-detect login in background while connect modal is open
  useEffect(() => {
    if (!activePlat) return;
    const interval = setInterval(async () => {
      try {
        const data = await checkPlatformLoginStatus(activePlat.id);
        if (data.logged_in) {
          clearInterval(interval);
          setModalMsg({ type: 'success', text: `Login confirmed - ${activePlat.name} session saved permanently` });
          const newConfig = {
            ...config,
            [activePlat.flag]: true,
            [`connected_${activePlat.id}`]: true,
          };
          await handleSaveConfig(newConfig);
          await loadPlatformStatuses();
          if (showToast) {
            showToast(`${activePlat.name} Connected and Verified`, 'success');
          }
          setTimeout(() => {
            setActivePlat(null);
          }, 1500);
        }
      } catch (e) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [activePlat, config]);

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500 text-sm">
        Loading portal configurations
      </div>
    );
  }

  const isPlatformConnected = (plat) => {
    if (platformStatuses[plat.id] !== undefined) {
      return !!platformStatuses[plat.id].connected;
    }
    return !!config[`connected_${plat.id}`];
  };

  const handleDisconnect = async (plat) => {
    try {
      await disconnectPlatform(plat.id);
      const newConfig = {
        ...config,
        [`connected_${plat.id}`]: false,
        [`auth_google_${plat.id}`]: false,
      };
      await handleSaveConfig(newConfig);
      await loadPlatformStatuses();
      if (showToast) {
        showToast(`${plat.name} disconnected.`, 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenConnect = async (plat) => {
    setActivePlat(plat);
    setModalLoading(true);
    setModalMsg({
      type: 'info',
      text: `Real Chrome is opening for ${plat.name} - Please complete sign-in in that window`
    });
    try {
      await openPlatformLoginBrowser(plat.id);
    } catch (err) {
      setModalMsg({ type: 'error', text: 'Error launching Chrome: ' + err.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleManualVerify = async () => {
    if (!activePlat) return;
    setModalLoading(true);
    try {
      const res = await verifyPlatformSession(activePlat.id);
      if (res.logged_in) {
        setModalMsg({ type: 'success', text: res.message });
        const newConfig = {
          ...config,
          [activePlat.flag]: true,
          [`connected_${activePlat.id}`]: true,
        };
        await handleSaveConfig(newConfig);
        await loadPlatformStatuses();
        if (showToast) {
          showToast(`${activePlat.name} connected permanently`, 'success');
        }
        setTimeout(() => {
          setActivePlat(null);
        }, 1200);
      } else {
        setModalMsg({
          type: 'error',
          text: res.message || 'Login not completed yet. Please finish signing in on the Chrome window'
        });
      }
    } catch (err) {
      setModalMsg({ type: 'error', text: 'Error verifying session: ' + err.message });
    } finally {
      setModalLoading(false);
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
    const nextVal = !config[plat.flag];
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
  const enabledCount = PLATFORMS_DATA.filter((p) => isPlatformConnected(p) && config[p.flag]).length;

  return (
    <div className="space-y-4 w-full max-w-full pb-10">
      {/* Top Header - No Background Card, Inline Header with View Switcher */}
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
              Real Chrome Connect (Option 2) / Click Connect, log in once in Chrome, and sessions are saved permanently
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
            const isEnabled = !!config[plat.flag];
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
                      <PlatformLogo id={plat.id} className="w-9 h-9 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                            {plat.name}
                          </h3>
                          {/* Scalloped Badge: Solid Filled Green if connected */}
                          <button
                            type="button"
                            onClick={() => handleToggleConnection(plat)}
                            className="cursor-pointer transition-transform hover:scale-110 active:scale-95 inline-flex items-center"
                            title={isConnected ? 'Connected & Verified (Click to disconnect)' : 'Not Connected (Click to connect)'}
                          >
                            <ScallopBadge
                              connected={isConnected}
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5 leading-tight">
                          {plat.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* iOS Style Toggle Switch */}
                    <div className="flex items-center shrink-0">
                      <label
                        className={`relative inline-flex items-center shrink-0 ${
                          isConnected ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                        }`}
                        title={
                          isConnected
                            ? isEnabled
                              ? `Disable ${plat.name}`
                              : `Enable ${plat.name}`
                            : `Connect ${plat.name} first to enable`
                        }
                        onClick={(e) => {
                          if (!isConnected) {
                            e.preventDefault();
                            handleTogglePlatform(plat);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isConnected && isEnabled}
                          disabled={!isConnected}
                          onChange={() => isConnected && handleTogglePlatform(plat)}
                          className="sr-only"
                        />
                        <div
                          className={`w-10 h-5.5 rounded-full transition-colors duration-200 relative shadow-inner ${
                            isConnected && isEnabled
                              ? 'bg-[#16a34a] !bg-[#16a34a]'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{
                            backgroundColor: isConnected && isEnabled ? '#16a34a' : undefined,
                          }}
                        >
                          <div
                            className={`absolute top-[2px] w-4.5 h-4.5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                              isConnected && isEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Description Paragraph */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal line-clamp-2 mb-2.5 min-h-[32px]">
                    {plat.desc}
                  </p>
                </div>

                {/* Single, Intuitive Action Area (Filled color buttons for Connected & Disconnect) */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[7px] bg-emerald-600 text-white text-xs font-bold shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Connected</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(plat)}
                        className="px-3 py-2 rounded-[7px] bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        title="Disconnect this platform"
                      >
                        Disconnect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenConnect(plat)}
                        className="p-2 rounded-[7px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="Re-open Chrome to check or switch account"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenConnect(plat)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[7px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-98 border border-blue-600"
                    >
                      <Globe2 className="w-3.5 h-3.5 text-white" />
                      <span>Connect {plat.name}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode: Compact Horizontal Rows */
        <div className="flex flex-col gap-2.5">
          {platformsList.map((plat, idx) => {
            const isEnabled = !!config[plat.flag];
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
                    className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300 p-0.5 select-none shrink-0"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <PlatformLogo id={plat.id} className="w-8 h-8 shrink-0 rounded-[4px]" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                        {plat.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleToggleConnection(plat)}
                        className="cursor-pointer transition-transform hover:scale-110 active:scale-95 inline-flex items-center"
                        title={isConnected ? 'Connected & Verified (Click to disconnect)' : 'Not Connected (Click to connect)'}
                      >
                        <ScallopBadge connected={isConnected} className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] text-slate-400 font-normal truncate hidden md:inline">
                        — {plat.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-xl">
                      {plat.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                  {/* iOS Style Toggle Switch */}
                  <label
                    className={`relative inline-flex items-center shrink-0 ${
                      isConnected ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                    }`}
                    title={
                      isConnected
                        ? isEnabled
                          ? `Disable ${plat.name}`
                          : `Enable ${plat.name}`
                        : `Connect ${plat.name} first to enable`
                    }
                    onClick={(e) => {
                      if (!isConnected) {
                        e.preventDefault();
                        handleTogglePlatform(plat);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isConnected && isEnabled}
                      disabled={!isConnected}
                      onChange={() => isConnected && handleTogglePlatform(plat)}
                      className="sr-only"
                    />
                    <div
                      className={`w-10 h-5.5 rounded-full transition-colors duration-200 relative shadow-inner ${
                        isConnected && isEnabled ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      style={{ backgroundColor: isConnected && isEnabled ? '#16a34a' : undefined }}
                    >
                      <div
                        className={`absolute top-[2px] w-4.5 h-4.5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                          isConnected && isEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                        }`}
                      />
                    </div>
                  </label>

                  {/* Buttons with filled colors */}
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-emerald-600 text-white text-xs font-bold shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Connected</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDisconnect(plat)}
                        className="px-3 py-1.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        title="Disconnect this platform"
                      >
                        Disconnect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenConnect(plat)}
                        className="p-1.5 rounded-[6px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="Re-open Chrome"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenConnect(plat)}
                      className="px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Globe2 className="w-3.5 h-3.5 text-white" />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trustworthy, Simple 1-Click Connect Modal */}
      {activePlat && (
        <div
          onClick={() => setActivePlat(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[16px] border border-slate-200/80 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <PlatformLogo id={activePlat.id} className="w-12 h-12 rounded-[10px]" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Connect {activePlat.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-0.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private & Local Connection</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActivePlat(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simple Trust-First Instruction Card */}
            <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200/70 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-900">
                Official {activePlat.name} Portal Opened
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                Sign in with <strong>Google, OTP, or your regular account</strong> in the open Chrome window.
              </p>
            </div>

            {/* Live Status Indicator */}
            {modalMsg && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-[10px] text-xs font-medium border ${
                  modalMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : modalMsg.type === 'info'
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {modalMsg.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                ) : modalMsg.type === 'info' ? (
                  <Loader2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">{modalMsg.text}</div>
              </div>
            )}

            {!modalMsg && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-[8px] bg-slate-100/80 text-xs text-slate-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                <span>Auto-detecting sign-in in Chrome window</span>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleManualVerify}
                disabled={modalLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-sm active:scale-98 disabled:opacity-50"
              >
                {modalLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Session</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white stroke-[2.5]" />
                    <span>I Have Signed In — Complete Setup</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleOpenConnect(activePlat)}
                  disabled={modalLoading}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Re-open Chrome Window
                </button>
              </div>
            </div>

            {/* Trust & Privacy Guarantee Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Zero passwords stored / 100% on device</span>
              </div>
              <button
                type="button"
                onClick={() => setActivePlat(null)}
                className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
