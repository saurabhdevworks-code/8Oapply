import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchConfig, saveConfig, fetchStatus, startBot, stopBot, fetchAppliedJobs, fetchPlatformStatus } from '../services/api';
import { useAuth } from './AuthContext';

const BotContext = createContext(null);

export function BotProvider({ children }) {
  const { user } = useAuth();
  const [config, setConfig] = useState({});
  const [status, setStatus] = useState({ running: false, uptime_seconds: 0, pid: null });
  const [appliedCount, setAppliedCount] = useState(0);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [platformsStatus, setPlatformsStatus] = useState(null);

  // 3 App Themes: 'light' (Clean Slate), 'dark' (Midnight Dark), 'indigo' (Deep Ocean)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('8oapply_theme') || localStorage.getItem('8omate_theme') || localStorage.getItem('jobbot_theme') || 'light';
  });

  const updateDocumentTheme = (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark' || newTheme === 'indigo') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('8oapply_theme', newTheme);
    localStorage.setItem('8omate_theme', newTheme);
    updateDocumentTheme(newTheme);
    if (config) {
      setConfig((prev) => ({ ...prev, theme: newTheme }));
      saveConfig({ ...config, theme: newTheme }).catch(() => {});
    }
  };

  useEffect(() => {
    updateDocumentTheme(theme);
  }, [theme]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  };

  const loadInitialData = useCallback(async () => {
    try {
      const [cfg, stat, jobs, platData] = await Promise.all([
        fetchConfig().catch(() => null),
        fetchStatus().catch(() => ({ running: false })),
        fetchAppliedJobs().catch(() => []),
        fetchPlatformStatus().catch(() => null),
      ]);
      if (platData?.platforms) {
        setPlatformsStatus(platData.platforms);
      }
      if (cfg) {
        setConfig(cfg);
        if (cfg.theme && !localStorage.getItem('8oapply_theme') && !localStorage.getItem('8omate_theme') && !localStorage.getItem('jobbot_theme')) {
          setTheme(cfg.theme);
          updateDocumentTheme(cfg.theme);
        }
      }
      if (stat) setStatus(stat);
      if (jobs) {
        const count = jobs.filter((j) => (j.status || '').toLowerCase() === 'applied').length;
        setAppliedCount(count);
        setTotalJobsCount(jobs.length);
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadInitialData();
    } else {
      setConfig(null);
      setAppliedCount(0);
      setTotalJobsCount(0);
      setLoading(false);
    }
  }, [user, loadInitialData]);

  // Status polling every 3 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const stat = await fetchStatus();
        setStatus(stat);
        const jobs = await fetchAppliedJobs();
        if (jobs) {
          const count = jobs.filter((j) => (j.status || '').toLowerCase() === 'applied').length;
          setAppliedCount(count);
          setTotalJobsCount(jobs.length);
        }
      } catch (err) {
        // Silently catch polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const checkProfileCompleteness = (cfg = config) => {
    if (!cfg) return { complete: false, reason: 'Profile data not loaded' };
    const missing = [];
    if (!cfg.name?.trim()) missing.push('Full Name');
    if (!cfg.email?.trim()) missing.push('Email Address');
    if (!cfg.phone?.trim()) missing.push('Phone Number');
    const hasEdu = Boolean(
      cfg.college?.trim() ||
      cfg.bachelor_college?.trim() ||
      cfg.master_college?.trim() ||
      cfg.degree?.trim() ||
      cfg.bachelor_degree?.trim() ||
      cfg.master_degree?.trim()
    );
    if (!hasEdu) missing.push('Education');
    if (missing.length > 0) {
      return {
        complete: false,
        reason: "First fill this Candidate Profile & Documents page info.",
      };
    }
    return { complete: true };
  };

  const reloadPlatformStatus = useCallback(async () => {
    try {
      const data = await fetchPlatformStatus();
      if (data?.platforms) {
        setPlatformsStatus(data.platforms);
        return data.platforms;
      }
    } catch (err) {
      console.error('Failed to reload platform status:', err);
    }
    return null;
  }, []);

  const checkRunnerReadiness = useCallback((cfg = config, plats = platformsStatus, forApply = false) => {
    if (forApply) {
      const profileCheck = checkProfileCompleteness(cfg);
      if (!profileCheck.complete) {
        return {
          ready: false,
          reason: profileCheck.reason,
          connectedCount: 0,
          readyCount: 0,
        };
      }
    }

    if (!plats) {
      return { ready: true, readyCount: 1, connectedCount: 1 };
    }

    const entries = Object.entries(plats);
    const connected = entries.filter(([k, p]) => Boolean(p.connected));
    const ready = entries.filter(([k, p]) => Boolean(p.connected) && Boolean(p.enabled));

    if (connected.length === 0) {
      return {
        ready: false,
        reason: 'First connect at least one platform',
        connectedCount: 0,
        readyCount: 0,
      };
    }

    if (ready.length === 0) {
      const connNames = connected.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
      return {
        ready: false,
        reason: 'At least one platform must be enabled',
        connectedCount: connected.length,
        readyCount: 0,
      };
    }

    if (!cfg?.job_titles?.length || !cfg?.locations?.length) {
      return {
        ready: false,
        reason: 'First add target job titles & locations in Search Targets & Preferences',
        connectedCount: connected.length,
        readyCount: ready.length,
      };
    }

    return {
      ready: true,
      connectedCount: connected.length,
      readyCount: ready.length,
    };
  }, [config, platformsStatus]);

  const handleStart = async () => {
    const readiness = checkRunnerReadiness();
    if (!readiness.ready) {
      showToast(readiness.reason, 'error');
      return;
    }
    try {
      await startBot();
      showToast('Runner started in Collect Only mode! Discovered jobs will be collected into your database.', 'success');
      const stat = await fetchStatus();
      setStatus(stat);
      reloadPlatformStatus();
    } catch (err) {
      showToast(err.message || 'Failed to start runner', 'error');
    }
  };

  const handleStop = async () => {
    try {
      await stopBot();
      showToast('Bot stopped safely.', 'warning');
      const stat = await fetchStatus();
      setStatus(stat);
    } catch (err) {
      showToast(err.message || 'Failed to stop bot', 'error');
    }
  };

  const handleSaveConfig = async (newConfig, silent = false) => {
    try {
      const toSave = newConfig || config;
      await saveConfig(toSave);
      setConfig(toSave);
      if (!silent) {
        showToast('Configuration saved successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save configuration', 'error');
      throw err;
    }
  };

  const updateConfigValue = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const reloadConfig = async () => {
    try {
      const cfg = await fetchConfig();
      if (cfg) setConfig(cfg);
    } catch (err) {}
  };

  return (
    <BotContext.Provider
      value={{
        config,
        setConfig,
        reloadConfig,
        status,
        appliedCount,
        totalJobsCount,
        loading,
        toast,
        showToast,
        theme,
        applyTheme,
        checkProfileCompleteness,
        checkRunnerReadiness,
        platformsStatus,
        reloadPlatformStatus,
        handleStart,
        handleStop,
        handleSaveConfig,
        updateConfigValue,
        reloadStatus: loadInitialData,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error('useBot must be used within BotProvider');
  return ctx;
}

export const useEightOApply = useBot;
export const EightOApplyProvider = BotProvider;
