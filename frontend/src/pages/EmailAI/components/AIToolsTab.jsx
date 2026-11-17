import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Key,
  RefreshCw,
  Zap,
  ExternalLink,
  MessageSquare,
  FileText,
  Save,
  CheckCircle,
  Copy,
  Download,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Briefcase,
  Calendar,
  Send,
} from 'lucide-react';
import {
  testAIConnection,
  tailorResume,
  draftRecruiterReply,
  askScreeningQuestion,
  fetchCustomAnswers,
  saveCustomAnswer,
  deleteCustomAnswer,
} from '../../../services/api';

export const AI_PROVIDERS = [
  {
    id: 'grok',
    name: 'xAI Grok',
    badge: 'Recommended',
    tagline: 'Lowest latency & smart reasoning',
    defaultModel: 'grok-2-latest',
    models: ['grok-2-latest', 'grok-beta'],
    getKeyUrl: 'https://console.x.ai/',
    color: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    badge: 'Popular',
    tagline: 'High accuracy for ATS questionnaires',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    getKeyUrl: 'https://platform.openai.com/api-keys',
    color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    badge: 'Advanced',
    tagline: 'Exceptional human-like cover notes',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    getKeyUrl: 'https://console.anthropic.com/',
    color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Fast',
    tagline: 'Generous free tier & high throughput',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
  },
];

const REPLY_SCENARIOS = [
  { id: 'accept_interview', label: 'Accept Interview', icon: Calendar },
  { id: 'request_reschedule', label: 'Request Reschedule', icon: RefreshCw },
  { id: 'confirm_assessment', label: 'Confirm Assessment (OA)', icon: CheckCircle2 },
  { id: 'salary_negotiation', label: 'CTC / Salary Inquiry', icon: Briefcase },
  { id: 'follow_up', label: 'Warm Follow-Up', icon: MessageSquare },
  { id: 'custom', label: 'Custom Guidance', icon: Sparkles },
];

export default function AIToolsTab({
  config,
  updateConfigValue,
  showToast,
  prefillReply,
}) {
  const selectedProviderId = config.ai_provider || 'grok';
  const currentProvider = AI_PROVIDERS.find((p) => p.id === selectedProviderId) || AI_PROVIDERS[0];
  const currentApiKey =
    config[`${selectedProviderId}_api_key`] ||
    (selectedProviderId === (config.ai_provider || 'grok') ? config.ai_api_key : '') ||
    '';

  const [testingAI, setTestingAI] = useState(false);

  const candidateDefaultRole = (Array.isArray(config.job_titles) && config.job_titles[0]) || config.job_title || '';

  // 1. Resume Tailor State
  const [resumeJobTitle, setResumeJobTitle] = useState(candidateDefaultRole);
  const [resumeCompany, setResumeCompany] = useState('');
  const [resumeJD, setResumeJD] = useState('');
  const [tailoringResume, setTailoringResume] = useState(false);
  const [tailoredResumeData, setTailoredResumeData] = useState(null);

  // 2. Recruiter Reply Drafter
  const [replyMessage, setReplyMessage] = useState(prefillReply?.message || '');
  const [replyScenario, setReplyScenario] = useState(prefillReply?.scenario || 'accept_interview');
  const [replyCompany, setReplyCompany] = useState(prefillReply?.company || '');
  const [replyJobTitle, setReplyJobTitle] = useState(prefillReply?.jobTitle || candidateDefaultRole);
  const [replyCustomNotes, setReplyCustomNotes] = useState('');
  const [draftingReply, setDraftingReply] = useState(false);
  const [generatedReplyDraft, setGeneratedReplyDraft] = useState('');

  // 3. Screening Questions Answerer
  const [screeningQuestion, setScreeningQuestion] = useState('');
  const [screeningCompany, setScreeningCompany] = useState('');
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [customAnswersList, setCustomAnswersList] = useState({});

  useEffect(() => {
    loadCustomAnswers();
  }, []);

  useEffect(() => {
    if (prefillReply) {
      if (prefillReply.company) setReplyCompany(prefillReply.company);
      if (prefillReply.jobTitle) setReplyJobTitle(prefillReply.jobTitle);
      if (prefillReply.message) setReplyMessage(prefillReply.message);
      if (prefillReply.scenario) setReplyScenario(prefillReply.scenario);
    }
  }, [prefillReply]);

  const loadCustomAnswers = async () => {
    try {
      const data = await fetchCustomAnswers();
      const answers = data?.custom_answers || data || {};
      if (typeof answers === 'object' && !Array.isArray(answers)) {
        setCustomAnswersList(answers);
      }
    } catch (e) {}
  };

  const handleProviderSelect = (provId) => {
    const prov = AI_PROVIDERS.find((p) => p.id === provId) || AI_PROVIDERS[0];
    updateConfigValue('ai_provider', provId);
    updateConfigValue('ai_model', prov.defaultModel);
  };

  const handleTestAI = async () => {
    if (!currentApiKey) {
      showToast(`Please enter your ${currentProvider.name} API key first`, 'error');
      return;
    }
    setTestingAI(true);
    try {
      const res = await testAIConnection({ provider: selectedProviderId, api_key: currentApiKey });
      if (res && res.status === 'success') {
        showToast(`${currentProvider.name} verified successfully: "${res.message}"`, 'success');
      } else {
        showToast(res?.message || 'Connection test failed', 'error');
      }
    } catch (e) {
      showToast(`AI verification error: ${e.message}`, 'error');
    } finally {
      setTestingAI(false);
    }
  };

  const handleGenerateTailoredResume = async () => {
    if (!resumeJD.trim()) {
      showToast('Please paste the Job Description (JD) first', 'warning');
      return;
    }
    setTailoringResume(true);
    try {
      const res = await tailorResume({
        job_title: resumeJobTitle || 'Software Engineer',
        company: resumeCompany || 'Target Company',
        job_description: resumeJD,
        provider: selectedProviderId,
        model: config.ai_model,
      });
      setTailoredResumeData(res);
      showToast('Custom ATS Resume generated successfully!', 'success');
    } catch (e) {
      showToast(`Resume error: ${e.message}`, 'error');
    } finally {
      setTailoringResume(false);
    }
  };

  const handleDraftRecruiterReply = async () => {
    if (!replyMessage.trim()) {
      showToast('Please paste the recruiter message or email first', 'warning');
      return;
    }
    setDraftingReply(true);
    try {
      const res = await draftRecruiterReply({
        recruiter_message: replyMessage,
        reply_scenario: replyScenario,
        custom_notes: replyCustomNotes,
        company: replyCompany,
        job_title: replyJobTitle,
        provider: selectedProviderId,
        model: config.ai_model,
      });
      if (res && res.draft) {
        setGeneratedReplyDraft(res.draft);
        showToast('Recruiter reply drafted!', 'success');
      }
    } catch (e) {
      showToast(`Draft error: ${e.message}`, 'error');
    } finally {
      setDraftingReply(false);
    }
  };

  const handleGenerateScreeningAnswer = async () => {
    if (!screeningQuestion.trim()) {
      showToast('Please enter an application question prompt', 'warning');
      return;
    }
    setGeneratingAnswer(true);
    try {
      const res = await askScreeningQuestion({
        question: screeningQuestion,
        company: screeningCompany,
      });
      if (res && res.answer) {
        setGeneratedAnswer(res.answer);
        showToast('Screening response generated!', 'success');
      }
    } catch (e) {
      showToast(`Screening error: ${e.message}`, 'error');
    } finally {
      setGeneratingAnswer(false);
    }
  };

  const handleSaveScreeningAnswer = async () => {
    if (!screeningQuestion.trim() || !generatedAnswer.trim()) {
      showToast('Question and answer cannot be empty', 'warning');
      return;
    }
    try {
      await saveCustomAnswer(screeningQuestion.trim(), generatedAnswer.trim());
      showToast('Answer saved to candidate memory bank!', 'success');
      loadCustomAnswers();
    } catch (e) {
      showToast(`Save error: ${e.message}`, 'error');
    }
  };

  const handleDeleteAnswer = async (q) => {
    try {
      await deleteCustomAnswer(q);
      showToast('Answer removed from memory', 'success');
      loadCustomAnswers();
    } catch (e) {
      showToast(`Delete error: ${e.message}`, 'error');
    }
  };

  const copyToClipboard = (text, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} to clipboard!`, 'success');
  };

  const downloadMarkdownResume = (content) => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(resumeCompany || 'Tailored').replace(/\s+/g, '_')}_Resume.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Downloaded tailored resume file', 'success');
  };

  return (
    <div className="space-y-4">
      {/* 0. API Vault */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-400" />
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Collect AI Provider APIs & Active Engine
              </h2>
              <span className="text-[11px] text-slate-400">
                Powers custom resume generation, smart recruiter replies, and screening questions.
              </span>
            </div>
          </div>
          <a
            href={currentProvider.getKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Get {currentProvider.name} Key <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AI_PROVIDERS.map((prov) => {
            const isSelected = selectedProviderId === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => handleProviderSelect(prov.id)}
                className={`p-2.5 rounded-[6px] border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-500/10 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{prov.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] border ${prov.color}`}>
                    {prov.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{prov.tagline}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentProvider.name} API Key</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={currentApiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  updateConfigValue(`${selectedProviderId}_api_key`, val);
                  updateConfigValue('ai_api_key', val);
                }}
                placeholder={`Paste your ${currentProvider.name} API key...`}
                className="flex-1 px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
              <button
                type="button"
                onClick={handleTestAI}
                disabled={testingAI || !currentApiKey}
                className="px-3.5 py-1.5 rounded-[5px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0 flex items-center gap-1.5"
              >
                {testingAI ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>{testingAI ? 'Verifying' : 'Test API'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Model Variant
            </label>
            <select
              value={config.ai_model || currentProvider.defaultModel}
              onChange={(e) => updateConfigValue('ai_model', e.target.value)}
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {currentProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m} {m === currentProvider.defaultModel ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 1. Custom Resume Generator */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  1. Custom Resume Generator Based on Job Description (JD)
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  ATS Tailor
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Paste any Job Description to generate role-aligned summaries, prioritized skills, and ATS bullet points.
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Role / Title</label>
            <input
              type="text"
              value={resumeJobTitle}
              onChange={(e) => setResumeJobTitle(e.target.value)}
              placeholder={candidateDefaultRole || "Target role (e.g. Java Developer)"}
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Company Name</label>
            <input
              type="text"
              value={resumeCompany}
              onChange={(e) => setResumeCompany(e.target.value)}
              placeholder="Enter hiring company name..."
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Paste Job Description (JD) Requirements
          </label>
          <textarea
            rows={4}
            value={resumeJD}
            onChange={(e) => setResumeJD(e.target.value)}
            placeholder="Paste the full job description, required skills, responsibilities, and qualifications here..."
            className="w-full px-3 py-2 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerateTailoredResume}
            disabled={tailoringResume}
            className="px-4 py-1.5 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {tailoringResume ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{tailoringResume ? 'Tailoring Resume...' : 'Generate Tailored Resume'}</span>
          </button>
        </div>

        {tailoredResumeData && (
          <div className="mt-3 p-3.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  ATS Tailoring Results
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-white">
                  {tailoredResumeData.match_score}% Match Score
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(tailoredResumeData.full_markdown_resume, 'Tailored Resume')}
                  className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadMarkdownResume(tailoredResumeData.full_markdown_resume)}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Tailored Professional Summary
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {tailoredResumeData.tailored_summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">
                  Matched Core Tech Stack
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(tailoredResumeData.matched_skills || []).map((sk, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block mb-1">
                  Keywords To Emphasize
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(tailoredResumeData.keywords_to_emphasize || []).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Tailored STAR Achievement Bullet Points
              </span>
              {(tailoredResumeData.tailored_bullet_points || []).map((b, i) => (
                <div key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Recruiter Reply Drafter */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  2. Smart Recruiter Reply Drafter ("Reply Where Need Better Response")
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  High Conversion
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Draft prompt, natural, high-impact responses to recruiter emails, scheduling conflicts, assessments, or salary queries.
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Company</label>
            <input
              type="text"
              value={replyCompany}
              onChange={(e) => setReplyCompany(e.target.value)}
              placeholder="Enter recruiter company..."
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Role</label>
            <input
              type="text"
              value={replyJobTitle}
              onChange={(e) => setReplyJobTitle(e.target.value)}
              placeholder={candidateDefaultRole || "Target role"}
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Select Reply Objective / Scenario
          </label>
          <div className="flex flex-wrap gap-1.5">
            {REPLY_SCENARIOS.map((sc) => {
              const IconComp = sc.icon;
              const isSel = replyScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setReplyScenario(sc.id)}
                  className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                    isSel
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <IconComp className="w-3 h-3" />
                  <span>{sc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Recruiter Message / Email Snippet
          </label>
          <textarea
            rows={3}
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Paste the recruiter's message, interview invitation, or query here..."
            className="w-full px-3 py-2 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Specific Custom Guidance / Time Availability (Optional)
          </label>
          <input
            type="text"
            value={replyCustomNotes}
            onChange={(e) => setReplyCustomNotes(e.target.value)}
            placeholder="e.g. Available Thursday 3-5 PM, notice period is immediate, ask about salary range"
            className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDraftRecruiterReply}
            disabled={draftingReply}
            className="px-4 py-1.5 rounded-[5px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {draftingReply ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{draftingReply ? 'Drafting Reply...' : 'Draft Recruiter Reply'}</span>
          </button>
        </div>

        {generatedReplyDraft && (
          <div className="mt-3 p-3.5 rounded-[6px] border border-blue-500/30 bg-blue-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-500 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Polished Recruiter Reply
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedReplyDraft, 'Reply')}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Reply</span>
              </button>
            </div>
            <div className="p-3 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {generatedReplyDraft}
            </div>
          </div>
        )}
      </div>

      {/* 3. Screening Questions Answerer */}
      <div className="bg-white dark:bg-slate-900 rounded-[8px] border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  3. Job Fields & Screening Questions Answerer
                </h2>
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Auto-Fill Memory
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Test and save answers to complex questionnaire prompts asked during job applications (ATS forms, Workday, Greenhouse).
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Screening Question Prompt
            </label>
            <input
              type="text"
              value={screeningQuestion}
              onChange={(e) => setScreeningQuestion(e.target.value)}
              placeholder="e.g. What is your experience in Java & Spring Boot? / Notice period?"
              className="w-full px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Target Company (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={screeningCompany}
                onChange={(e) => setScreeningCompany(e.target.value)}
                placeholder="Enter company name..."
                className="flex-1 px-3 py-1.5 rounded-[5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateScreeningAnswer}
                disabled={generatingAnswer}
                className="px-3.5 py-1.5 rounded-[5px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0 flex items-center gap-1"
              >
                {generatingAnswer ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>{generatingAnswer ? 'Thinking' : 'Answer'}</span>
              </button>
            </div>
          </div>
        </div>

        {generatedAnswer && (
          <div className="p-3 rounded-[6px] border border-purple-500/30 bg-purple-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400">
                Generated Candidate Answer:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedAnswer, 'Answer')}
                  className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveScreeningAnswer}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>Save to Memory Bank</span>
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={generatedAnswer}
              onChange={(e) => setGeneratedAnswer(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
            Learned Answers Memory Bank ({Object.keys(customAnswersList).length})
          </span>
          {Object.keys(customAnswersList).length === 0 ? (
            <p className="text-[11px] text-slate-400">
              No custom answers saved yet. When application forms ask unique questions, 8Oapply stores authentic answers here to auto-fill them on future applications.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {Object.entries(customAnswersList)
                .filter(([q, a]) => typeof a === 'string' || typeof a === 'number')
                .map(([q, a], idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-[5px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                        {String(q)}
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {String(a)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnswer(q)}
                      className="text-slate-400 hover:text-red-400 p-1 rounded shrink-0 cursor-pointer"
                      title="Delete saved answer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
