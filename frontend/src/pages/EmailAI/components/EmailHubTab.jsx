import React, { useState } from 'react';
import {
  Mail,
  Send,
  Zap,
  RefreshCw,
  Inbox,
  Paperclip,
  Award,
  Calendar,
  FileText,
  Sparkles,
} from 'lucide-react';
import ScallopBadge from '../../../components/common/ScallopBadge';
import {
  checkInboxForResponses,
  applyDirectEmail,
  testEmailSettings,
  testTriggerAlert,
  draftRecruiterReply,
} from '../../../services/api';

export default function EmailHubTab({
  config,
  updateConfigValue,
  showToast,
  setIsGmailModalOpen,
  analyzedResponses,
  loadResponsesData,
  loadingResponses,
  onSwitchToReply,
}) {
  const [scanningInbox, setScanningInbox] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const candidateDefaultRole = (Array.isArray(config.job_titles) && config.job_titles[0]) || config.job_title || '';
  const [directRecruiterEmail, setDirectRecruiterEmail] = useState('');
  const [directCompany, setDirectCompany] = useState('');
  const [directJobTitle, setDirectJobTitle] = useState(candidateDefaultRole);
  const [directSubject, setDirectSubject] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directAttachResume, setDirectAttachResume] = useState(true);
  const [sendingDirectApply, setSendingDirectApply] = useState(false);
  const [draftingPitch, setDraftingPitch] = useState(false);

  // Real Email Responses: Filter out rows that have no recruiter correspondence
  const realEmailRecords = (Array.isArray(analyzedResponses) ? analyzedResponses : []).filter((r) =>
    (r.email_snippet && r.email_snippet.trim().length > 0) ||
    ['Interview Scheduled', 'Assessment (OA)', 'Offer', 'Rejected'].includes(r.status) ||
    r.last_response_date
  );

  // Triggers
  const [testingTriggerType, setTestingTriggerType] = useState(null);

  const handleScanInbox = async () => {
    if (!config.smtp_user) {
      showToast('Please connect your Gmail account first', 'warning');
      setIsGmailModalOpen(true);
      return;
    }
    setScanningInbox(true);
    try {
      const res = await checkInboxForResponses();
      if (res.status === 'skipped') {
        showToast(res.message, 'warning');
      } else {
        showToast(
          `Scanned ${res.scanned || 0} emails: detected ${res.positive_detected || 0} positive responses!`,
          'success'
        );
        loadResponsesData();
      }
    } catch (e) {
      showToast(`Inbox scan error: ${e.message}`, 'error');
    } finally {
      setScanningInbox(false);
    }
  };

  const handleTestEmail = async () => {
    const user = config.smtp_user;
    if (!user) {
      showToast('Please connect your Gmail account first', 'warning');
      setIsGmailModalOpen(true);
      return;
    }
    const recipient = config.recipient_email || user;
    setTestingEmail(true);
    try {
      await testEmailSettings({ recipient_email: recipient });
      showToast(`Verification test email dispatched to ${recipient}`, 'success');
    } catch (e) {
      showToast(`Email test error: ${e.message}`, 'error');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleDraftDirectPitch = async () => {
    setDraftingPitch(true);
    try {
      const targetRole = directJobTitle || candidateDefaultRole || 'Software Engineer';
      const targetComp = directCompany.trim() || 'Hiring Team';
      const res = await draftRecruiterReply({
        recruiter_message: `Direct job application for: ${targetRole} at ${targetComp}`,
        reply_scenario: 'custom',
        custom_notes: `Write a compelling, professional cold email pitch for ${config.name || 'Candidate'} applying for ${targetRole} at ${targetComp}. Candidate background: ${config.degree || 'MCA'} from ${config.college || 'VIT Bhopal'}. Core technical skills: ${config.skills || 'Java, Spring Boot, React'}. State clearly that candidate's resume is attached. Keep it concise, high-signal, and professional.`,
        company: targetComp,
        job_title: targetRole,
        provider: config.ai_provider || 'grok',
        model: config.ai_model,
      });
      if (res && res.draft) {
        setDirectBody(res.draft);
        if (!directSubject) {
          setDirectSubject(`Application: ${targetRole} — ${config.name || 'Candidate'}`);
        }
        showToast('AI application pitch generated from your candidate profile!', 'success');
      }
    } catch (e) {
      showToast(`Pitch error: ${e.message}`, 'error');
    } finally {
      setDraftingPitch(false);
    }
  };

  const handleSendDirectApply = async () => {
    if (!directRecruiterEmail.trim() || !directRecruiterEmail.includes('@')) {
      showToast('Please provide a valid recruiter email address', 'warning');
      return;
    }
    if (!directBody.trim()) {
      showToast('Please provide an email message or pitch body', 'warning');
      return;
    }
    setSendingDirectApply(true);
    try {
      const targetRole = directJobTitle.trim() || candidateDefaultRole || 'Software Engineer';
      const targetComp = directCompany.trim() || 'Company';
      await applyDirectEmail({
        recruiter_email: directRecruiterEmail.trim(),
        subject: directSubject.trim() || `Application for ${targetRole} — ${config.name || 'Candidate'}`,
        body: directBody.trim(),
        attach_resume: directAttachResume,
        company: targetComp,
        job_title: targetRole,
      });
      showToast(`Application emailed to ${directRecruiterEmail}! Logged in History.`, 'success');
      setDirectRecruiterEmail('');
      setDirectSubject('');
      setDirectBody('');
      loadResponsesData();
    } catch (e) {
      showToast(`Failed to dispatch application: ${e.message}`, 'error');
    } finally {
      setSendingDirectApply(false);
    }
  };

  const handleTestTrigger = async (type) => {
    const user = config.recipient_email || config.smtp_user;
    if (!user) {
      showToast('Please connect Gmail or configure Recipient Email first', 'warning');
      setIsGmailModalOpen(true);
      return;
    }
    setTestingTriggerType(type);
    try {
      const res = await testTriggerAlert({
        trigger_type: type,
        to_email: user,
        job_title: candidateDefaultRole || 'Software Engineer',
        company: directCompany.trim() || undefined,
      });
      showToast(res.message || `${type} alert test dispatched to ${user}!`, 'success');
    } catch (e) {
      showToast(`Trigger test error: ${e.message}`, 'error');
    } finally {
      setTestingTriggerType(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 0. Gmail Connection */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-[6px] bg-white dark:bg-slate-950 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs">
              <svg className="w-5 h-5" viewBox="0 49.4 512 399.42">
                <path fill="#4285F4" d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z" />
                <path fill="#34A853" d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z" />
                <path fill="#FBBC05" d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z" />
                <path fill="#EA4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
                <path fill="#C5221F" d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Recruiter Gmail Account</span>
                <ScallopBadge connected={!!config.smtp_user} className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {config.smtp_user ? (
                  <span className="text-emerald-500 font-semibold">{config.smtp_user} &bull; Connected & Watching</span>
                ) : (
                  'Connect Gmail to automatically track recruiter replies and send direct email applications'
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanInbox}
              disabled={scanningInbox || !config.smtp_user}
              className="px-3.5 py-1.5 rounded-[5px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningInbox ? 'animate-spin' : ''}`} />
              <span>{scanningInbox ? 'Scanning...' : 'Scan Inbox Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGmailModalOpen(true)}
              className="px-3.5 py-1.5 rounded-[5px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              {config.smtp_user ? 'Manage Gmail' : 'Connect Gmail'}
            </button>
          </div>
        </div>
      </div>

      {/* 1. Analysis of All E-mails */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  1. Analysis of All E-mails Related to Applied Jobs
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Real-Time Tracking
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Continuously matches incoming recruiter correspondence against your applied companies, classifying Exam links, Interviews, and Offers.
              </span>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-500">
            {realEmailRecords.length} Recruiter Responses Analyzed
          </span>
        </div>

        {loadingResponses ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading analyzed email records...</div>
        ) : realEmailRecords.length === 0 ? (
          <div className="py-8 px-4 text-center rounded-[6px] border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <Inbox className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              No Recruiter Correspondence Detected Yet
            </div>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto mt-1 mb-3">
              When companies reply with interview invitations, online assessment links, or updates, they will appear here with extracted sentiment and AI Smart Reply drafting.
            </p>
            <button
              type="button"
              onClick={handleScanInbox}
              disabled={scanningInbox || !config.smtp_user}
              className="px-3.5 py-1.5 rounded-[5px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanningInbox ? 'animate-spin' : ''}`} />
              <span>{scanningInbox ? 'Scanning Recruiter Inbox...' : 'Scan Recruiter Inbox Now'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {realEmailRecords.map((r, i) => {
              const statusLower = (r.status || '').toLowerCase();
              const isOffer = statusLower.includes('offer');
              const isExam = statusLower.includes('assessment') || statusLower.includes('oa') || statusLower.includes('exam');
              const isInterview = statusLower.includes('interview');
              const isReject = statusLower.includes('reject');

              return (
                <div
                  key={i}
                  className={`p-3 rounded-[6px] border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isOffer
                      ? 'border-purple-500/40 bg-purple-500/5'
                      : isExam
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : isInterview
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : isReject
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {typeof r.company === 'string' ? r.company : String(r.company || 'Company')}
                      </span>
                      {r.job_title && (
                        <span className="text-[11px] text-slate-400">
                          &bull; {typeof r.job_title === 'string' ? r.job_title : String(r.job_title)}
                        </span>
                      )}
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                          isOffer
                            ? 'bg-purple-500 text-white'
                            : isExam
                            ? 'bg-blue-600 text-white'
                            : isInterview
                            ? 'bg-emerald-600 text-white'
                            : isReject
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {typeof r.status === 'string' ? r.status : String(r.status || 'Applied')}
                      </span>
                      {r.last_response_date && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.last_response_date}
                        </span>
                      )}
                    </div>
                    {r.email_snippet && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 font-mono bg-white/50 dark:bg-slate-900/50 p-1.5 rounded">
                        {typeof r.email_snippet === 'string' ? r.email_snippet : String(r.email_snippet)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.sender_email && (
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        {typeof r.sender_email === 'string' ? r.sender_email : String(r.sender_email || '')}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        let scenario = 'accept_interview';
                        if (isExam) scenario = 'confirm_assessment';
                        else if (isOffer) scenario = 'salary_negotiation';
                        onSwitchToReply({
                          company: r.company || '',
                          jobTitle: r.job_title || candidateDefaultRole,
                          message: r.email_snippet || '',
                          scenario,
                        });
                      }}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Smart Reply</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Direct Email Apply */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  2. Direct Email Apply & Cold Outreach Dispatcher
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Resume Attached
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Send personalized application pitches directly to hiring managers or recruiter inboxes with your resume.pdf attached.
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Recruiter / HR Email
            </label>
            <input
              type="email"
              value={directRecruiterEmail}
              onChange={(e) => setDirectRecruiterEmail(e.target.value)}
              placeholder="recruiter@company.com"
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Target Company
            </label>
            <input
              type="text"
              value={directCompany}
              onChange={(e) => setDirectCompany(e.target.value)}
              placeholder="Enter hiring company name..."
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Target Role
            </label>
            <input
              type="text"
              value={directJobTitle}
              onChange={(e) => setDirectJobTitle(e.target.value)}
              placeholder={candidateDefaultRole || "e.g. Java Developer"}
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email Subject Line
            </label>
            <button
              type="button"
              onClick={handleDraftDirectPitch}
              disabled={draftingPitch}
              className="text-[11px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>{draftingPitch ? 'Drafting Pitch...' : 'AI Generate Subject & Pitch'}</span>
            </button>
          </div>
          <input
            type="text"
            value={directSubject}
            onChange={(e) => setDirectSubject(e.target.value)}
            placeholder={`Application for ${directJobTitle || candidateDefaultRole || 'Software Engineer'} — ${config.name || 'Candidate'}`}
            className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Application Message / Cover Pitch
          </label>
          <textarea
            rows={4}
            value={directBody}
            onChange={(e) => setDirectBody(e.target.value)}
            placeholder="Write or AI-generate your personalized cold application pitch..."
            className="w-full px-3 py-2 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={directAttachResume}
              onChange={(e) => setDirectAttachResume(e.target.checked)}
              className="rounded text-blue-600"
            />
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            <span>Attach candidate resume.pdf to email</span>
          </label>

          <button
            type="button"
            onClick={handleSendDirectApply}
            disabled={sendingDirectApply || !config.smtp_user}
            className="px-4 py-1.5 rounded-[5px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {sendingDirectApply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sendingDirectApply ? 'Sending Application...' : 'Send Email Application'}</span>
          </button>
        </div>
      </div>

      {/* 3. Alert Triggers */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  3. Positive Response Alert Triggers (Exam &bull; Interview &bull; Offer Letter)
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  High Priority Alert
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Immediately triggers high-priority email alerts to your personal inbox when positive signals are detected.
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Personal Alert Notification Recipient Email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={config.recipient_email || ''}
              onChange={(e) => updateConfigValue('recipient_email', e.target.value)}
              placeholder={config.smtp_user || 'your-personal-email@gmail.com'}
              className="flex-1 px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="px-3 py-1.5 rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs shrink-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3 h-3 text-slate-500" />
              <span>{testingEmail ? 'Sending...' : 'Test SMTP'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Offer Letter */}
          <div className="p-3 rounded-[6px] border border-purple-500/30 bg-purple-500/5 flex flex-col justify-between space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Offer Letter Trigger
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Formal offers & packages
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.alert_on_offer !== false}
                  onChange={(e) => updateConfigValue('alert_on_offer', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-8 h-4.5 rounded-full transition-colors relative ${
                    config.alert_on_offer !== false ? 'bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-[2px] w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                      config.alert_on_offer !== false ? 'translate-x-[14px]' : 'translate-x-[2px]'
                    }`}
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={() => handleTestTrigger('offer')}
              disabled={testingTriggerType === 'offer'}
              className="w-full py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold cursor-pointer transition disabled:opacity-50"
            >
              {testingTriggerType === 'offer' ? 'Dispatching...' : 'Test Offer Alert'}
            </button>
          </div>

          {/* Exam / OA */}
          <div className="p-3 rounded-[6px] border border-blue-500/30 bg-blue-500/5 flex flex-col justify-between space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Exam / OA Link Trigger
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    HackerRank, Codility & tests
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.alert_on_exam !== false}
                  onChange={(e) => updateConfigValue('alert_on_exam', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-8 h-4.5 rounded-full transition-colors relative ${
                    config.alert_on_exam !== false ? 'bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-[2px] w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                      config.alert_on_exam !== false ? 'translate-x-[14px]' : 'translate-x-[2px]'
                    }`}
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={() => handleTestTrigger('exam')}
              disabled={testingTriggerType === 'exam'}
              className="w-full py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-bold cursor-pointer transition disabled:opacity-50"
            >
              {testingTriggerType === 'exam' ? 'Dispatching...' : 'Test Exam Alert'}
            </button>
          </div>

          {/* Interview Scheduled */}
          <div className="p-3 rounded-[6px] border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Interview Invitation Trigger
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Calendly, Zoom, Google Meet
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={config.alert_on_interview !== false}
                  onChange={(e) => updateConfigValue('alert_on_interview', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-8 h-4.5 rounded-full transition-colors relative ${
                    config.alert_on_interview !== false ? 'bg-[#16a34a]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-[2px] w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                      config.alert_on_interview !== false ? 'translate-x-[14px]' : 'translate-x-[2px]'
                    }`}
                  />
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={() => handleTestTrigger('interview')}
              disabled={testingTriggerType === 'interview'}
              className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer transition disabled:opacity-50"
            >
              {testingTriggerType === 'interview' ? 'Dispatching...' : 'Test Interview Alert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
