import React, { useState, useEffect, useRef } from 'react';
import { useBot } from '../../context/BotContext';
import {
  fetchResumeStatus,
  uploadResume,
  parseResume,
  deleteResume,
  fetchCustomAnswers,
  saveCustomAnswer,
  deleteCustomAnswer,
  getAuthToken,
} from '../../services/api';
import {
  UserCheck,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Save,
  GraduationCap,
  User,
  Globe,
  Briefcase,
  ShieldCheck,
  Plus,
  Trash2,
  Sparkles,
  Eye,
} from 'lucide-react';

export default function ProfilePage() {
  const { config, setConfig, reloadConfig, updateConfigValue, handleSaveConfig, showToast } = useBot();
  const [resumeInfo, setResumeInfo] = useState({ exists: false, size_kb: 0 });
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [showEraseModal, setShowEraseModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customAnswers, setCustomAnswers] = useState({});
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [addingQA, setAddingQA] = useState(false);
  const fileInputRef = useRef(null);

  const getResumeDisplayName = () => {
    if (!resumeInfo?.exists) {
      return null;
    }
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

  const loadResume = async () => {
    try {
      const data = await fetchResumeStatus();
      setResumeInfo(data);
    } catch (err) {
      console.error('Failed to get resume info:', err);
    }
  };

  const loadQAs = async () => {
    try {
      const res = await fetchCustomAnswers();
      if (res && res.custom_answers) {
        setCustomAnswers(res.custom_answers);
      }
    } catch (err) {
      console.error('Failed to load custom screening answers:', err);
    }
  };

  useEffect(() => {
    loadResume();
    loadQAs();
  }, []);

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
      if (res.config && setConfig) {
        setConfig(res.config);
      } else if (reloadConfig) {
        await reloadConfig();
      }
      const extractedCount = Object.keys(res.extracted || {}).length;
      showToast(
        `Resume uploaded & parsed! Extracted ${extractedCount} profile fields (contact, education, skills, links).`,
        'success'
      );
      loadResume();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewResume = () => {
    const token = getAuthToken();
    const url = token ? `/api/resume?token=${encodeURIComponent(token)}` : '/api/resume';
    window.open(url, '_blank');
  };

  const handleDeleteResume = async () => {
    setDeletingResume(true);
    try {
      await deleteResume();
      setResumeInfo({ exists: false, size_kb: 0 });
      showToast(`${getResumeDisplayName()} deleted successfully`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete resume', 'error');
    } finally {
      setDeletingResume(false);
    }
  };

  const handleReparseResume = async () => {
    setParsing(true);
    try {
      const res = await parseResume();
      if (res.config && setConfig) {
        setConfig(res.config);
      } else if (reloadConfig) {
        await reloadConfig();
      }
      const count = Object.keys(res.extracted_fields || {}).length;
      showToast(`Extracted ${count} profile fields directly from ${getResumeDisplayName()}!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to extract resume info', 'error');
    } finally {
      setParsing(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const highestCollege = config.master_college || config.bachelor_college || config.college || '';
      const highestDegree = config.master_degree || config.bachelor_degree || config.degree || '';
      const highestGradYear = config.master_grad_year || config.bachelor_grad_year || config.grad_year || '';

      const updated = {
        ...config,
        college: highestCollege,
        degree: highestDegree,
        grad_year: highestGradYear,
        master_score: config.master_score || '',
        bachelor_score: config.bachelor_score || '',
        linkedin: config.linkedin_url || config.linkedin || '',
        github: config.github_url || config.github || '',
        portfolio: config.portfolio_url || config.portfolio || '',
      };
      await handleSaveConfig(updated);
      showToast('Candidate profile updated successfully', 'success');
    } finally {
      setSaving(false);
    }
  };

  const executeEraseData = async () => {
    setErasing(true);
    try {
      const clearedFields = {
        name: '',
        email: '',
        phone: '',
        current_city: '',
        experience: '',
        notice_period: '',
        current_company: '',
        current_role: '',
        current_ctc: '',
        expected_ctc: '',
        master_college: '',
        master_grad_year: '',
        master_degree: '',
        master_score: '',
        bachelor_college: '',
        bachelor_grad_year: '',
        bachelor_degree: '',
        bachelor_score: '',
        college: '',
        degree: '',
        grad_year: '',
        linkedin_url: '',
        linkedin: '',
        github_url: '',
        github: '',
        portfolio_url: '',
        portfolio: '',
        skills: '',
        cover_note: '',
      };
      const updated = { ...config, ...clearedFields };
      await handleSaveConfig(updated);
      showToast('Candidate profile data erased successfully', 'success');
      setShowEraseModal(false);
    } catch (err) {
      showToast(err.message || 'Failed to erase data', 'error');
    } finally {
      setErasing(false);
    }
  };

  const handleAddCustomQA = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      showToast('Please enter both question and answer', 'error');
      return;
    }
    setAddingQA(true);
    try {
      await saveCustomAnswer(newQuestion.trim(), newAnswer.trim());
      setCustomAnswers((prev) => ({
        ...prev,
        [newQuestion.trim()]: newAnswer.trim(),
      }));
      setNewQuestion('');
      setNewAnswer('');
      showToast('Screening question answer saved to knowledge base', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save question answer', 'error');
    } finally {
      setAddingQA(false);
    }
  };

  const handleDeleteCustomQA = async (qText) => {
    try {
      await deleteCustomAnswer(qText);
      setCustomAnswers((prev) => {
        const copy = { ...prev };
        delete copy[qText];
        return copy;
      });
      showToast('Question removed from knowledge base', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete question', 'error');
    }
  };

  if (!config) {
    return <div className="text-slate-500 text-xs">Loading profile...</div>;
  }

  return (
    <div className="space-y-4 w-full max-w-full pb-8">
      {/* Top Header - Aligned to match all pages */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Candidate Profile & Documents
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Default candidate credentials, resume, and AI screening knowledge base used for portal forms and direct applications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowEraseModal(true)}
            disabled={saving || erasing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Erase all candidate profile fields"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{erasing ? 'Erasing' : 'Erase Data'}</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || erasing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Columns: Credentials & Profile Sections */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Personal & Contact Details */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Personal & Contact Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={config.name || ''}
                  onChange={(e) => updateConfigValue('name', e.target.value)}
                  placeholder="Auto-extracted from resume or enter name..."
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={config.email || ''}
                  onChange={(e) => updateConfigValue('email', e.target.value)}
                  placeholder="Auto-extracted from resume or enter email..."
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={config.phone || ''}
                  onChange={(e) => updateConfigValue('phone', e.target.value)}
                  placeholder="10-digit mobile number..."
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Current City / Location</label>
                <input
                  type="text"
                  value={config.current_city || ''}
                  onChange={(e) => updateConfigValue('current_city', e.target.value)}
                  placeholder="Auto-extracted from resume or enter city..."
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* 2. Work Experience & Compensation */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Work Experience & Compensation</h3>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Leave blank if fresher
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Years of Experience
                </label>
                <input
                  type="text"
                  value={config.experience || ''}
                  onChange={(e) => updateConfigValue('experience', e.target.value)}
                  placeholder="Leave blank if fresher (e.g. 1.5)"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notice Period (Days)
                </label>
                <input
                  type="text"
                  value={config.notice_period || ''}
                  onChange={(e) => updateConfigValue('notice_period', e.target.value)}
                  placeholder="e.g. 0 (Immediate)"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current / Recent Company
                </label>
                <input
                  type="text"
                  value={config.current_company || ''}
                  onChange={(e) => updateConfigValue('current_company', e.target.value)}
                  placeholder="Leave blank if fresher"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current / Recent Role Title
                </label>
                <input
                  type="text"
                  value={config.current_role || ''}
                  onChange={(e) => updateConfigValue('current_role', e.target.value)}
                  placeholder="Leave blank if fresher"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Current CTC (INR / Annually)</label>
                <input
                  type="text"
                  value={config.current_ctc || ''}
                  onChange={(e) => updateConfigValue('current_ctc', e.target.value)}
                  placeholder="e.g. 0"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Expected CTC (INR / Annually)</label>
                <input
                  type="text"
                  value={config.expected_ctc || ''}
                  onChange={(e) => updateConfigValue('expected_ctc', e.target.value)}
                  placeholder="e.g. 800000"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Education */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Education</h3>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                ATS Qualification Credentials
              </span>
            </div>

            {/* Sub-card A: Master's / Postgraduate Degree */}
            <div className="p-3.5 rounded-[6px] bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Postgraduate / Master's Degree
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Higher Qualification (Optional)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    College / University Name
                  </label>
                  <input
                    type="text"
                    value={config.master_college || ''}
                    onChange={(e) => updateConfigValue('master_college', e.target.value)}
                    placeholder="e.g. VIT Bhopal University"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Graduation / Passing Year
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={config.master_grad_year || ''}
                    onChange={(e) => updateConfigValue('master_grad_year', e.target.value)}
                    placeholder="e.g. 2025"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Degree & Specialization
                  </label>
                  <input
                    type="text"
                    value={config.master_degree || ''}
                    onChange={(e) => updateConfigValue('master_degree', e.target.value)}
                    placeholder="e.g. MCA - Master of Computer Applications"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Percentage / CGPA
                  </label>
                  <input
                    type="text"
                    value={config.master_score || ''}
                    onChange={(e) => updateConfigValue('master_score', e.target.value)}
                    placeholder="e.g. 8.5 CGPA or 85%"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Sub-card B: Bachelor's / Undergraduate Degree */}
            <div className="p-3.5 rounded-[6px] bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                  Undergraduate / Bachelor's Degree
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Undergraduate Qualification</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    College / University Name
                  </label>
                  <input
                    type="text"
                    value={config.bachelor_college || ''}
                    onChange={(e) => updateConfigValue('bachelor_college', e.target.value)}
                    placeholder="e.g. CSJM University"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Graduation / Passing Year
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={config.bachelor_grad_year || ''}
                    onChange={(e) => updateConfigValue('bachelor_grad_year', e.target.value)}
                    placeholder="e.g. 2023"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Degree & Specialization
                  </label>
                  <input
                    type="text"
                    value={config.bachelor_degree || ''}
                    onChange={(e) => updateConfigValue('bachelor_degree', e.target.value)}
                    placeholder="e.g. BCA - Bachelor of Computer Applications"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Percentage / CGPA
                  </label>
                  <input
                    type="text"
                    value={config.bachelor_score || ''}
                    onChange={(e) => updateConfigValue('bachelor_score', e.target.value)}
                    placeholder="e.g. 71% or 7.5 CGPA"
                    className="w-full px-2.5 py-1.5 rounded-[4px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Online Portfolios & Profiles */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Online Portfolios & Profiles</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={config.linkedin_url || ''}
                  onChange={(e) => updateConfigValue('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">GitHub Profile URL</label>
                <input
                  type="url"
                  value={config.github_url || ''}
                  onChange={(e) => updateConfigValue('github_url', e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">Portfolio / Personal Site</label>
                <input
                  type="url"
                  value={config.portfolio_url || ''}
                  onChange={(e) => updateConfigValue('portfolio_url', e.target.value)}
                  placeholder="https://yourportfolio.dev"
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* 5. Tech Stack & Professional Background */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Tech Stack & Professional Background</h3>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Technical Skills (Comma separated)
              </label>
              <input
                type="text"
                value={config.skills || ''}
                onChange={(e) => updateConfigValue('skills', e.target.value)}
                placeholder="Auto-extracted from resume or enter skills separated by commas..."
                className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Professional Bio & Cover Note (Used by AI as profile context)
              </label>
              <textarea
                rows={3}
                value={config.cover_note || ''}
                onChange={(e) => updateConfigValue('cover_note', e.target.value)}
                placeholder="Auto-extracted from resume summary or enter statement..."
                className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* 6. Work Authorization & Relocation */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Work Authorization & Relocation</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Legally Authorized to Work
                </label>
                <select
                  value={config.work_authorized !== undefined ? String(config.work_authorized) : 'true'}
                  onChange={(e) => updateConfigValue('work_authorized', e.target.value === 'true')}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="true">Yes, authorized to work</option>
                  <option value="false">No, not authorized</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Require Visa Sponsorship
                </label>
                <select
                  value={config.require_sponsorship !== undefined ? String(config.require_sponsorship) : 'false'}
                  onChange={(e) => updateConfigValue('require_sponsorship', e.target.value === 'true')}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="false">No, do not require sponsorship</option>
                  <option value="true">Yes, require sponsorship</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Willing to Relocate
                </label>
                <select
                  value={config.willing_to_relocate !== undefined ? String(config.willing_to_relocate) : 'true'}
                  onChange={(e) => updateConfigValue('willing_to_relocate', e.target.value === 'true')}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="true">Yes, open to relocation</option>
                  <option value="false">No, prefer local only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Open to Remote Roles
                </label>
                <select
                  value={config.open_to_remote !== undefined ? String(config.open_to_remote) : 'true'}
                  onChange={(e) => updateConfigValue('open_to_remote', e.target.value === 'true')}
                  className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="true">Yes, open to remote / hybrid</option>
                  <option value="false">No, on-site only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Resume Card & AI Screening Q&A Repository */}
        <div className="space-y-4">
          {/* Resume Upload Card */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Active Document{resumeInfo.exists && getResumeDisplayName() ? ` (${getResumeDisplayName()})` : ''}</h3>
            </div>

            {/* Status indicator with Delete Button */}
            <div
              className={`p-3 rounded-[6px] border flex items-center justify-between gap-2.5 text-xs ${
                resumeInfo.exists
                  ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {resumeInfo.exists ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {resumeInfo.exists ? (getResumeDisplayName() || 'Resume Verified') : 'No Resume Uploaded'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {resumeInfo.exists
                      ? `File Size: ${resumeInfo.size_kb} KB`
                      : 'A PDF resume is required for automatic attachments.'}
                  </div>
                </div>
              </div>

              {resumeInfo.exists && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleViewResume}
                    className="w-8 h-8 rounded-[4px] bg-transparent text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center justify-center transition cursor-pointer shrink-0"
                    title={`View ${getResumeDisplayName()}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteResume}
                    disabled={deletingResume}
                    className="w-8 h-8 rounded-[4px] bg-transparent text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center justify-center transition cursor-pointer disabled:opacity-50 shrink-0"
                    title={`Delete ${getResumeDisplayName()}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-[6px] p-5 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/50"
            >
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {uploading ? 'Processing & extracting profile info...' : resumeInfo.exists ? `Select to replace ${getResumeDisplayName() || 'resume'}` : 'Select or drop your PDF resume'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically extracts your contact, education, skills, and portfolio info
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Manual Re-parse Button */}
            {resumeInfo.exists && (
              <button
                type="button"
                onClick={handleReparseResume}
                disabled={parsing || uploading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                title={`Extracts personal info, skills, education, and links directly from ${getResumeDisplayName()}`}
              >
                <Sparkles className={`w-3.5 h-3.5 text-white ${parsing ? 'animate-spin' : ''}`} />
                <span>{parsing ? 'Extracting Profile Info' : 'Auto-Extract Profile Info from Resume'}</span>
              </button>
            )}
          </div>

          {/* Career Portal AI Screening Knowledge Base */}
          <div className="p-4 rounded-[8px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Career Portal Screening Answers
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {Object.keys(customAnswers).length} Answers
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              When applying via career portals (Lever, Greenhouse, Workday, SmartRecruiters, Ashby), questions matching these entries will be filled directly, or synthesized using AI with your profile context.
            </p>

            {/* List of Custom Q&As */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {Object.keys(customAnswers).length === 0 ? (
                <div className="p-3 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 text-center">
                  No custom answers saved yet. Add your preferred answers below.
                </div>
              ) : (
                Object.entries(customAnswers).map(([q, a], idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-[6px] bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1 relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">{q}</div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomQA(q)}
                        title="Delete question answer"
                        className="text-slate-400 hover:text-red-500 transition cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{a}</div>
                  </div>
                ))
              )}
            </div>

            {/* Add Custom Q&A Form */}
            <form onSubmit={handleAddCustomQA} className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Add Screening Question</div>
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Why are you interested in this role?"
                className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
              />
              <textarea
                rows={2}
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="e.g. I am passionate about modern full-stack architectures and eager to solve high-scale challenges"
                className="w-full px-2.5 py-1.5 rounded-[4px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={addingQA}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>{addingQA ? 'Saving' : 'Add to Knowledge Base'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal for Erasing Candidate Data */}
      {showEraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[12px] p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Erase Candidate Profile Data?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to erase all candidate profile data? This will clear personal info, contact details, experience, education, degrees, percentages/CGPA, tech skills, and portfolio links.
                </p>
                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-[4px] p-2">
                  Without profile data and a verified resume, you will not be able to apply to jobs.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEraseModal(false)}
                disabled={erasing}
                className="px-3.5 py-1.5 rounded-[6px] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeEraseData}
                disabled={erasing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{erasing ? 'Erasing...' : 'Yes, Erase Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
