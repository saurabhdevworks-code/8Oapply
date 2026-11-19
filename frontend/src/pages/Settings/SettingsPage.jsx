import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBot } from '../../context/BotContext';
import {
  generateAIMessage,
  testAIConnection,
  fetchResumeStatus,
  uploadResume,
  deleteResume,
  testEmailSettings,
} from '../../services/api';
import PlatformLogo from '../../components/common/PlatformLogo';
import {
  Settings,
  User,
  GraduationCap,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Sparkles,
  Bot,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  FileCheck,
  Lock,
  Mail,
  MapPin,
  IndianRupee,
  Clock,
  Compass,
  ExternalLink,
  Plus,
  X,
  Laptop,
  Phone,
  Shield,
  Smartphone,
  Monitor,
  Trash2,
  LogOut,
  Sliders,
  Sun,
  Moon,
  Palette,
  Globe,
  Radio,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  GripVertical,
  ListOrdered,
} from 'lucide-react';

const AI_PROVIDERS = [
  {
    id: 'grok',
    name: 'xAI Grok',
    endpoint: 'console.grok.com',
    models: ['grok-2-latest', 'grok-2-mini', 'grok-beta'],
    defaultModel: 'grok-2-latest',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'platform.openai.com',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    endpoint: 'console.anthropic.com',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    defaultModel: 'claude-3-5-sonnet-latest',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    endpoint: 'aistudio.google.com',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash',
  },
];

const SUPPORTED_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', flag: 'use_linkedin', emailKey: 'linkedin_email', passKey: 'linkedin_password' },
  { id: 'naukri', name: 'Naukri', flag: 'use_naukri', emailKey: 'naukri_email', passKey: 'naukri_password' },
  { id: 'internshala', name: 'Internshala', flag: 'use_internshala', emailKey: 'internshala_email', passKey: 'internshala_password' },
  { id: 'foundit', name: 'Foundit', flag: 'use_foundit', emailKey: 'foundit_email', passKey: 'foundit_password' },
  { id: 'shine', name: 'Shine', flag: 'use_shine', emailKey: 'shine_email', passKey: 'shine_password' },
  { id: 'glassdoor', name: 'Glassdoor', flag: 'use_glassdoor', emailKey: 'glassdoor_email', passKey: 'glassdoor_password' },
  { id: 'wellfound', name: 'Wellfound', flag: 'use_wellfound', emailKey: 'wellfound_email', passKey: 'wellfound_password' },
  { id: 'timesjobs', name: 'TimesJobs', flag: 'use_timesjobs', emailKey: 'timesjobs_email', passKey: 'timesjobs_password' },
  { id: 'indeed', name: 'Indeed', flag: 'use_indeed', emailKey: 'indeed_email', passKey: 'indeed_password' },
  { id: 'others', name: 'Direct ATS / Others', flag: 'use_others', emailKey: 'others_email', passKey: 'others_password' },
];

const DEFAULT_PLATFORM_PRIORITY = [
  'linkedin',
  'indeed',
  'naukri',
  'glassdoor',
  'internshala',
  'shine',
  'foundit',
  'timesjobs',
  'wellfound',
  'others',
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { config, updateConfigValue, handleSaveConfig, showToast, theme, applyTheme } = useBot();

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['platforms', 'targets', 'schedule', 'mail', 'profile', 'security', 'appearance'].includes(tabParam)) {
      return tabParam;
    }
    return 'platforms';
  });

  const [saving, setSaving] = useState(false);
  const [resumeInfo, setResumeInfo] = useState({ exists: false, size_kb: 0 });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Password visibility maps
  const [showPassMap, setShowPassMap] = useState({});
  const togglePassVisibility = (key) => {
    setShowPassMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Auth & Security state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updatingAuth, setUpdatingAuth] = useState(false);

  // AI API & Message Generator state
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingProvider, setTestingProvider] = useState(null);
  const [genRole, setGenRole] = useState('');
  const [genCompany, setGenCompany] = useState('');
  const [genType, setGenType] = useState('cover_letter');
  const [genDesc, setGenDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Job targets state
  const [newRole, setNewRole] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // Platform Execution Priority Order helpers
  const currentPriorityOrder = React.useMemo(() => {
    const saved = config?.platform_priority_order || config?.platform_priority;
    if (Array.isArray(saved) && saved.length > 0) {
      const lowerSaved = saved.map((p) => (typeof p === 'string' ? p.toLowerCase() : ''));
      const combined = [...lowerSaved.filter(Boolean)];
      DEFAULT_PLATFORM_PRIORITY.forEach((p) => {
        if (!combined.includes(p)) combined.push(p);
      });
      return combined;
    }
    return DEFAULT_PLATFORM_PRIORITY;
  }, [config?.platform_priority_order, config?.platform_priority]);

  const handleMovePriority = (index, direction) => {
    const newOrder = [...currentPriorityOrder];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    updateConfigValue('platform_priority_order', newOrder);
  };

  const handleMoveToTop = (index) => {
    if (index === 0) return;
    const newOrder = [...currentPriorityOrder];
    const [item] = newOrder.splice(index, 1);
    newOrder.unshift(item);
    updateConfigValue('platform_priority_order', newOrder);
  };

  const handleSetPriorityRank = (fromIndex, toRank) => {
    const toIndex = Math.max(0, Math.min(currentPriorityOrder.length - 1, toRank - 1));
    if (fromIndex === toIndex) return;
    const newOrder = [...currentPriorityOrder];
    const [item] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, item);
    updateConfigValue('platform_priority_order', newOrder);
  };

  const handleResetPriorityOrder = () => {
    updateConfigValue('platform_priority_order', DEFAULT_PLATFORM_PRIORITY);
  };

  const handleEnableAllPlatforms = () => {
    SUPPORTED_PLATFORMS.forEach((p) => {
      updateConfigValue(p.flag, true);
    });
  };

  // Email test state
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Active Sessions Mock Data
  const [sessions, setSessions] = useState([
    {
      id: 'session-1',
      device: 'Windows 11 PC (Current Device)',
      browser: 'Chrome 124.0.0',
      ip: '192.168.1.3 (Local Network)',
      location: 'Noida, Uttar Pradesh, India',
      lastActive: 'Active Now',
      isCurrent: true,
      activeNow: true,
    },
    {
      id: 'session-2',
      device: 'MacBook Pro 16',
      browser: 'Safari 17.4',
      ip: '103.21.124.88',
      location: 'Delhi, India',
      lastActive: '2 hours ago',
      isCurrent: false,
      activeNow: false,
    },
  ]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['platforms', 'targets', 'schedule', 'mail', 'profile', 'security', 'appearance'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (config?.email && !newEmail) {
      setNewEmail(config.email);
    }
  }, [config?.email]);

  const loadResume = async () => {
    try {
      const data = await fetchResumeStatus();
      setResumeInfo(data);
    } catch (err) {
      console.error('Failed to get resume info:', err);
    }
  };

  useEffect(() => {
    loadResume();
  }, []);

  if (!config) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading your settings</span>
      </div>
    );
  }

  const getResumeDisplayName = () => {
    const rawName = config?.name?.trim();
    if (rawName) {
      const clean = rawName.replace(/[^\w\s-]/g, '').replace(/[\s-]+/g, '_');
      if (clean) return `${clean}_Resume.pdf`;
    }
    if (resumeInfo?.filename && resumeInfo.filename.endsWith('.pdf') && resumeInfo.filename !== 'resume.pdf') {
      return resumeInfo.filename;
    }
    return 'Candidate_Resume.pdf';
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const selectedProviderId = config.ai_provider || 'grok';
  const currentProvider =
    AI_PROVIDERS.find((p) => p.id === selectedProviderId) || AI_PROVIDERS[0];

  const onSave = async () => {
    setSaving(true);
    try {
      await handleSaveConfig();
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAccountCredentials = async (e) => {
    e.preventDefault();
    setUpdatingAuth(true);
    try {
      if (newEmail.trim()) {
        updateConfigValue('email', newEmail.trim());
      }
      showToast('Account credentials updated successfully', 'success');
      setNewPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to update credentials', 'error');
    } finally {
      setUpdatingAuth(false);
    }
  };

  const handleRevokeSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Session logged out successfully', 'success');
  };

  const handleLogoutAll = () => {
    setSessions((prev) => prev.filter((s) => s.activeNow));
    showToast('Logged out of all other devices', 'success');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Only PDF documents are supported', 'error');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadResume(file);
      showToast(`Resume updated successfully (${res.size_kb} KB)`, 'success');
      loadResume();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProviderChange = (newProvId) => {
    const provObj = AI_PROVIDERS.find((p) => p.id === newProvId) || AI_PROVIDERS[0];
    updateConfigValue('ai_provider', newProvId);
    updateConfigValue('ai_model', provObj.defaultModel);
  };

  const handleTestSpecificAI = async (provId) => {
    const provObj = AI_PROVIDERS.find((p) => p.id === provId) || AI_PROVIDERS[0];
    const key = config[`${provId}_api_key`] || (provId === selectedProviderId ? config.ai_api_key : '');
    if (!key) {
      showToast(`Please enter your ${provObj.name} API key first`, 'error');
      return;
    }

    setTestingProvider(provId);
    try {
      const res = await testAIConnection(provId, key);
      if (res.status === 'ok') {
        showToast(`${provObj.name} verified successfully: "${res.message}"`, 'success');
      } else {
        showToast(res.message || 'Connection failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to connect to API', 'error');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleGenerateAI = async () => {
    const key = config.ai_api_key || config[`${selectedProviderId}_api_key`];
    if (!key) {
      showToast(`Please configure an API key for ${currentProvider.name} first`, 'error');
      return;
    }

    const role = genRole.trim() || config.job_titles?.[0] || 'Software Engineer';
    const comp = genCompany.trim() || 'Target Company';

    setGenerating(true);
    try {
      const res = await generateAIMessage({
        role,
        company: comp,
        job_description: genDesc,
        message_type: genType,
      });
      setGeneratedText(res.content || '');
      showToast(`Message drafted using ${currentProvider.name}`, 'success');
    } catch (err) {
      showToast(err.message || 'Generation failed. Check your API key.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyGenerated = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyAsCoverNote = async () => {
    if (!generatedText) return;
    updateConfigValue('cover_note', generatedText);
    try {
      await handleSaveConfig({ ...config, cover_note: generatedText });
      showToast('Saved as active Cover Note across application forms', 'success');
    } catch (err) {
      showToast('Failed to save to config', 'error');
    }
  };

  const handleAddRole = (e) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    const currentList = Array.isArray(config.job_titles) ? config.job_titles : [];
    if (!currentList.includes(newRole.trim())) {
      updateConfigValue('job_titles', [...currentList, newRole.trim()]);
    }
    setNewRole('');
  };

  const handleRemoveRole = (roleToRemove) => {
    const currentList = Array.isArray(config.job_titles) ? config.job_titles : [];
    updateConfigValue('job_titles', currentList.filter((r) => r !== roleToRemove));
  };

  const handleAddLocation = (e) => {
    e.preventDefault();
    if (!newLocation.trim()) return;
    const currentList = Array.isArray(config.locations) ? config.locations : [];
    if (!currentList.includes(newLocation.trim())) {
      updateConfigValue('locations', [...currentList, newLocation.trim()]);
    }
    setNewLocation('');
  };

  const handleRemoveLocation = (locToRemove) => {
    const currentList = Array.isArray(config.locations) ? config.locations : [];
    updateConfigValue('locations', currentList.filter((l) => l !== locToRemove));
  };

  const handleResetDefaults = () => {
    updateConfigValue('max_per_platform', 50);
    updateConfigValue('delay_min', 12);
    updateConfigValue('delay_max', 25);
    updateConfigValue('platform_rest_min', 600);
    updateConfigValue('platform_rest_max', 900);
    updateConfigValue('page_load_wait', 8);
    updateConfigValue('manual_login_wait', 45);
    showToast('Reset engine timings to safe defaults. Save to apply.', 'info');
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const payload = {
        smtp_host: config.smtp_host || 'smtp.gmail.com',
        smtp_port: parseInt(config.smtp_port, 10) || 587,
        smtp_user: config.smtp_user || config.email || '',
        smtp_password: config.smtp_password || '',
        recipient_email: config.recipient_email || config.email || '',
      };
      await testEmailSettings(payload);
      showToast(`Test email dispatched to ${payload.recipient_email}`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to send test email', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Page-wise tabs structure
  const tabs = [
    { id: 'platforms', label: 'Platforms' },
    { id: 'targets', label: 'Job Targets' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'mail', label: 'Mail' },
    { id: 'profile', label: 'Profile & Resume' },
    { id: 'security', label: 'Account & Security' },
    { id: 'appearance', label: 'Appearance' },
  ];

  return (
    <div className="w-full max-w-full pb-16 pt-1">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure page-wise parameters, portal automations, scheduling rules, and AI screening intelligence.
          </p>
        </div>

        {/* Global Save Action */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'platforms' && (
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Defaults
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Underline Pill Tabs */}
      <div className="border-b border-slate-200/90 dark:border-slate-800 mb-6">
        <nav className="flex items-center gap-6 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 text-xs uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer border-b-2 font-bold ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: PLATFORMS SETTINGS                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'platforms' && (
        <div className="space-y-6">
          {/* Platform Credentials & Portals Execution Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Job Portals Credentials & Auto-Apply Toggles
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                10 Automated ATS Platforms
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUPPORTED_PLATFORMS.map((plat) => {
                const isEnabled = config[plat.flag] !== false;
                const isPassVisible = !!showPassMap[plat.passKey];
                return (
                  <div
                    key={plat.id}
                    className="p-3.5 rounded-[8px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <PlatformLogo id={plat.id} className="w-6 h-6 rounded-[3px]" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {plat.name}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => updateConfigValue(plat.flag, e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-9 h-5 rounded-full transition-colors duration-200 relative shadow-inner ${
                            isEnabled ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{ backgroundColor: isEnabled ? '#16a34a' : undefined }}
                        >
                          <div
                            className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md ${
                              isEnabled ? 'translate-x-[16px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </div>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={config[plat.emailKey] || ''}
                        onChange={(e) => updateConfigValue(plat.emailKey, e.target.value)}
                        placeholder={`${plat.name} Login Email`}
                        className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                      />
                      <div className="relative">
                        <input
                          type={isPassVisible ? 'text' : 'password'}
                          value={config[plat.passKey] || ''}
                          onChange={(e) => updateConfigValue(plat.passKey, e.target.value)}
                          placeholder={`${plat.name} Password`}
                          className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => togglePassVisibility(plat.passKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engine Execution Timings & Limits */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Compass className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                WebDriver Engine Timings & Execution Limits
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Applications Per Platform
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={config.max_per_platform ?? 50}
                  onChange={(e) => updateConfigValue('max_per_platform', parseInt(e.target.value, 10) || 50)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Page Load Wait (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.page_load_wait ?? 8}
                  onChange={(e) => updateConfigValue('page_load_wait', parseInt(e.target.value, 10) || 8)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manual Login Wait (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={config.manual_login_wait ?? 45}
                  onChange={(e) => updateConfigValue('manual_login_wait', parseInt(e.target.value, 10) || 45)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Browser Preference
                </label>
                <select
                  value={config.browser || 'auto'}
                  onChange={(e) => updateConfigValue('browser', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                >
                  <option value="auto">Auto-detect (Edge, Brave, or Chrome)</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="brave">Brave Browser</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Anti-Detection Delay (Sec Min - Max)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={config.delay_min ?? 12}
                    onChange={(e) => updateConfigValue('delay_min', parseInt(e.target.value, 10) || 12)}
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={config.delay_max ?? 25}
                    onChange={(e) => updateConfigValue('delay_max', parseInt(e.target.value, 10) || 25)}
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inter-Platform Rest (Sec Min - Max)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="30"
                    max="1800"
                    value={config.platform_rest_min ?? 600}
                    onChange={(e) => updateConfigValue('platform_rest_min', parseInt(e.target.value, 10) || 600)}
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="number"
                    min="60"
                    max="3600"
                    value={config.platform_rest_max ?? 900}
                    onChange={(e) => updateConfigValue('platform_rest_max', parseInt(e.target.value, 10) || 900)}
                    className="w-1/2 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: JOB TARGETS SETTINGS                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          {/* Target Roles Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Target Job Titles & Keyword Matching
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {Array.isArray(config.job_titles) ? config.job_titles.length : 0} Configured
              </span>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(Array.isArray(config.job_titles) ? config.job_titles : []).map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(t)}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddRole} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Full Stack Developer, React Engineer"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  Add Role
                </button>
              </form>
            </div>
          </div>

          {/* Target Locations Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Target Locations & Geo Preferences
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {Array.isArray(config.locations) ? config.locations.length : 0} Cities
              </span>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(Array.isArray(config.locations) ? config.locations : []).map((loc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLocation(loc)}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddLocation} className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Noida, Bangalore, Remote"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  Add Location
                </button>
              </form>
            </div>
          </div>

          {/* Job Post Age & Collection Volume Quota Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Job Post Age & Collection Limits
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Set how many days old posts to collect, and specify maximum collection volume per platform.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                Freshness: Last {config.job_post_age_days ?? 7} Days
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Feature 1: How many days old posts/jobs to collect */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>How Many Days Old Posts/Jobs to Collect</span>
                  </label>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {config.job_post_age_days ?? 7} Days Max
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={config.job_post_age_days ?? 7}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      updateConfigValue('job_post_age_days', val);
                    }}
                    className="w-24 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="7"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Days Old</span>
                </div>

                {/* Quick Presets for Post Age */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: '24 Hours (1 Day)', value: 1 },
                    { label: '3 Days', value: 3 },
                    { label: '7 Days (1 Wk)', value: 7 },
                    { label: '14 Days (2 Wks)', value: 14 },
                    { label: '30 Days (1 Mo)', value: 30 },
                  ].map((preset) => {
                    const isSelected = (config.job_post_age_days ?? 7) === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateConfigValue('job_post_age_days', preset.value)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Scrapers on Indeed, LinkedIn, Naukri, and Glassdoor will collect only jobs published within this window and automatically ignore older postings.
                </p>
              </div>

              {/* Feature 2: How many jobs to collect per platform */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Max Jobs to Collect (Per Platform)
                  </label>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {config.max_per_platform ?? 50} Listings
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="500"
                    step="5"
                    value={config.max_per_platform ?? 50}
                    onChange={(e) => {
                      const val = Math.max(5, parseInt(e.target.value, 10) || 25);
                      updateConfigValue('max_per_platform', val);
                      updateConfigValue('max_jobs_to_collect', val);
                    }}
                    className="w-24 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="50"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Jobs / Platform</span>
                </div>

                {/* Quick Presets for Collection Volume */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[25, 50, 100, 200].map((qty) => {
                    const isSelected = (config.max_per_platform ?? 50) === qty;
                    return (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => {
                          updateConfigValue('max_per_platform', qty);
                          updateConfigValue('max_jobs_to_collect', qty);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {qty} Jobs
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Limits the maximum number of new unapplied listings collected per platform in each automated or scheduled discovery run.
                </p>
              </div>
            </div>

            {/* Experience & Expected CTC secondary row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Work Experience (Years)
                </label>
                <input
                  type="text"
                  value={config.experience || ''}
                  onChange={(e) => updateConfigValue('experience', e.target.value)}
                  placeholder="Leave blank if fresher, or e.g. 1.5"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected CTC (INR / Annually)
                </label>
                <input
                  type="text"
                  value={config.expected_ctc || config.salary || ''}
                  onChange={(e) => updateConfigValue('expected_ctc', e.target.value)}
                  placeholder="e.g. 800000"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Feature: Priority Order of Platforms */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Platform Execution Priority Order
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Rank platforms in the exact sequence you want 8Oapply to collect and apply to jobs. Use Move Up/Down buttons or the rank selector.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPriorityOrder}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Reset to Default
                </button>
                <button
                  type="button"
                  onClick={handleEnableAllPlatforms}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 hover:bg-purple-100 transition cursor-pointer"
                >
                  Enable All
                </button>
              </div>
            </div>

            {/* Interactive Priority List */}
            <div className="space-y-2">
              {currentPriorityOrder.map((platId, idx) => {
                const platObj = SUPPORTED_PLATFORMS.find((p) => p.id === platId) || {
                  id: platId,
                  name: platId.charAt(0).toUpperCase() + platId.slice(1),
                  flag: `use_${platId}`,
                };
                const isEnabled = config[platObj.flag] !== false;
                const isTop = idx === 0;
                const isSecond = idx === 1;

                return (
                  <div
                    key={platId}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 select-none ${
                      isTop
                        ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50/40 dark:bg-purple-950/20 shadow-2xs'
                        : isSecond
                        ? 'border-blue-200 dark:border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/15'
                        : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Left: Drag grip indicator + Rank + Logo + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />

                      {/* Rank Badge */}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md font-mono shrink-0 ${
                          isTop
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : isSecond
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        #{idx + 1}
                      </span>

                      <PlatformLogo id={platObj.id} className="w-6 h-6 rounded-[3px] shrink-0" />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {platObj.name}
                          </span>
                          {isTop && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                              Top Priority
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {isEnabled ? 'Active in execution queue' : 'Disabled in platform settings'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Quick Rank Jump + Move Up / Down Buttons + Enable Switch */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Priority Rank Selector */}
                      <select
                        value={idx + 1}
                        onChange={(e) => handleSetPriorityRank(idx, parseInt(e.target.value, 10))}
                        className="text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                        title="Jump to priority rank"
                      >
                        {currentPriorityOrder.map((_, rIdx) => (
                          <option key={rIdx + 1} value={rIdx + 1}>
                            Rank #{rIdx + 1}
                          </option>
                        ))}
                      </select>

                      {/* Move to Top */}
                      {!isTop && (
                        <button
                          type="button"
                          onClick={() => handleMoveToTop(idx)}
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Move to top priority (#1)"
                        >
                          <ArrowUpToLine className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMovePriority(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Up in Priority"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMovePriority(idx, 1)}
                        disabled={idx === currentPriorityOrder.length - 1}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move Down in Priority"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Toggle Enable/Disable Platform */}
                      <button
                        type="button"
                        onClick={() => updateConfigValue(platObj.flag, !isEnabled)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-md transition cursor-pointer border ${
                          isEnabled
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: SCHEDULE SETTINGS                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Autonomous Scheduler Master Daemon */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Daily Autonomous Scheduler Daemon
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Controls the background cron service that automatically runs discovery, application, and inbox scanner.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!config.scheduler_enabled}
                  onChange={(e) => updateConfigValue('scheduler_enabled', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative shadow-inner ${
                    config.scheduler_enabled ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  style={{ backgroundColor: config.scheduler_enabled ? '#16a34a' : undefined }}
                >
                  <div
                    className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-md ${
                      config.scheduler_enabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                    }`}
                  />
                </div>
              </label>
            </div>

            <div className="space-y-3 pt-1">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                Scheduled Execution Times
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {(Array.isArray(config.scheduled_times) ? config.scheduled_times : ['09:30', '13:00', '17:30', '21:00']).map((t) => (
                  <div
                    key={t}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 font-mono"
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(config.scheduled_times) ? config.scheduled_times : ['09:30', '13:00', '17:30', '21:00'];
                        updateConfigValue('scheduled_times', current.filter((item) => item !== t));
                      }}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: MAIL SETTINGS                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'mail' && (
        <div className="space-y-6">
          {/* Notification Recipient & Triggers */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Notification Recipient & Automated Triggers
                </h3>
              </div>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3 text-blue-600" />
                <span>{sendingTestEmail ? 'Sending...' : 'Send Test Email'}</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notification Recipient Email Address
              </label>
              <input
                type="email"
                value={config.recipient_email || config.email || ''}
                onChange={(e) => updateConfigValue('recipient_email', e.target.value)}
                placeholder="your-email@gmail.com"
                className="w-full max-w-md px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Where recruiter interview invitations, online assessment links, and daily digest summaries will be delivered.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-[6px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Instant Email on Positive (+ve) Response
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Dispatches high-priority email alert when recruiter replies.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.alert_on_positive !== false}
                    onChange={(e) => updateConfigValue('alert_on_positive', e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-9 h-5 rounded-full transition-colors duration-200 relative shadow-inner ${
                      config.alert_on_positive !== false ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{ backgroundColor: config.alert_on_positive !== false ? '#16a34a' : undefined }}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md ${
                        config.alert_on_positive !== false ? 'translate-x-[16px]' : 'translate-x-[2px]'
                      }`}
                    />
                  </div>
                </label>
              </div>

              <div className="p-3 rounded-[6px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Daily Application Digest Email
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Dispatches summary table of jobs applied at end of day.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={config.daily_digest !== false}
                    onChange={(e) => updateConfigValue('daily_digest', e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-9 h-5 rounded-full transition-colors duration-200 relative shadow-inner ${
                      config.daily_digest !== false ? 'bg-[#16a34a] !bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                    style={{ backgroundColor: config.daily_digest !== false ? '#16a34a' : undefined }}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-md ${
                        config.daily_digest !== false ? 'translate-x-[16px]' : 'translate-x-[2px]'
                      }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Outbound SMTP Server Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Outbound SMTP Mail Server
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={config.smtp_host || 'smtp.gmail.com'}
                  onChange={(e) => updateConfigValue('smtp_host', e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={config.smtp_port ?? 587}
                  onChange={(e) => updateConfigValue('smtp_port', parseInt(e.target.value, 10))}
                  placeholder="587"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SMTP Username / Email
                </label>
                <input
                  type="text"
                  value={config.smtp_user || ''}
                  onChange={(e) => updateConfigValue('smtp_user', e.target.value)}
                  placeholder="sender@gmail.com"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SMTP App Password
                </label>
                <input
                  type="password"
                  value={config.smtp_password || ''}
                  onChange={(e) => updateConfigValue('smtp_password', e.target.value)}
                  placeholder="Google 16-character App Password"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: PROFILE & RESUME SETTINGS                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Active Document Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Active Document{resumeInfo.exists && getResumeDisplayName() ? ` (${getResumeDisplayName()})` : ''}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {resumeInfo.exists ? `Verified (${resumeInfo.size_kb} KB)` : 'Document Not Found'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-[6px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
              <div className="flex items-center gap-3">
                {resumeInfo.exists ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {resumeInfo.exists ? `${getResumeDisplayName()} Verified & Attached` : 'No Resume Uploaded'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {resumeInfo.exists
                      ? 'Attached automatically during bot application submissions.'
                      : 'Required to apply for jobs across all portals.'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : resumeInfo.exists ? 'Replace Resume' : 'Upload Resume'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Extraction & Model Provider Configuration */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  AI Screening & ATS Answer Synthesis Provider
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Automatic Failover:</span>
                <button
                  type="button"
                  onClick={() => updateConfigValue('ai_fallback_enabled', !(config.ai_fallback_enabled ?? true))}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] border ${
                    config.ai_fallback_enabled ?? true
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200'
                  }`}
                >
                  {config.ai_fallback_enabled ?? true ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {AI_PROVIDERS.map((prov) => {
                const isSelected = selectedProviderId === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderChange(prov.id)}
                    className={`p-3 rounded-[6px] border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{prov.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{prov.defaultModel}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {currentProvider.name} API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config[`${selectedProviderId}_api_key`] || config.ai_api_key || ''}
                    onChange={(e) => {
                      updateConfigValue(`${selectedProviderId}_api_key`, e.target.value);
                      updateConfigValue('ai_api_key', e.target.value);
                    }}
                    placeholder={`Enter ${currentProvider.name} API Key`}
                    className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Active Model
                </label>
                <div className="flex gap-2">
                  <select
                    value={config.ai_model || currentProvider.defaultModel}
                    onChange={(e) => updateConfigValue('ai_model', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleTestSpecificAI(selectedProviderId)}
                    disabled={testingProvider === selectedProviderId}
                    className="px-3 py-1.5 rounded-[4px] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition shrink-0"
                  >
                    {testingProvider === selectedProviderId ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: ACCOUNT & SECURITY SETTINGS                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Account Login Profile
              </h3>
            </div>

            <form onSubmit={handleUpdateAccountCredentials} className="space-y-4 max-w-md">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your-account@gmail.com"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Change Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new account password"
                  className="w-full px-2.5 py-1.5 text-xs rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={updatingAuth}
                className="px-4 py-1.5 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
              >
                {updatingAuth ? 'Updating...' : 'Update Account'}
              </button>
            </form>
          </div>

          {/* Active Sessions */}
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Active Login Devices & Sessions
                </h3>
              </div>
              <button
                type="button"
                onClick={handleLogoutAll}
                className="text-xs font-bold text-red-600 hover:text-red-700 transition"
              >
                Logout Other Devices
              </button>
            </div>

            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-[6px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{s.device}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {s.ip} · {s.location} · {s.lastActive}
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      className="text-xs text-red-500 hover:text-red-600 transition"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 7: APPEARANCE SETTINGS                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[10px] border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Workspace Aesthetic & Themes
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => applyTheme('light')}
                className={`p-4 rounded-[8px] border text-left transition cursor-pointer ${
                  theme === 'light'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-500 mb-2" />
                <div className="text-xs font-bold text-slate-900">Clean Slate Light</div>
                <div className="text-[11px] text-slate-500 mt-0.5">High-contrast daytime workspace</div>
              </button>

              <button
                type="button"
                onClick={() => applyTheme('dark')}
                className={`p-4 rounded-[8px] border text-left transition cursor-pointer ${
                  theme === 'dark'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-950'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-700 bg-slate-950'
                }`}
              >
                <Moon className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-xs font-bold text-slate-100">Midnight Dark</div>
                <div className="text-[11px] text-slate-400 mt-0.5">OLED midnight slate workspace</div>
              </button>

              <button
                type="button"
                onClick={() => applyTheme('indigo')}
                className={`p-4 rounded-[8px] border text-left transition cursor-pointer ${
                  theme === 'indigo'
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-[#090d16]'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-700 bg-[#090d16]'
                }`}
              >
                <Palette className="w-5 h-5 text-indigo-400 mb-2" />
                <div className="text-xs font-bold text-slate-100">Deep Ocean Indigo</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Deep ocean navy aesthetic</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
