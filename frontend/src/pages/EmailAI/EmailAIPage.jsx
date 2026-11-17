import React, { useState, useEffect } from 'react';
import { useBot } from '../../context/BotContext';
import ConnectGmailModal from '../../components/common/ConnectGmailModal';
import { Sparkles, BrainCircuit, Mail, Save } from 'lucide-react';
import AIToolsTab from './components/AIToolsTab';
import EmailHubTab from './components/EmailHubTab';
import { fetchResponses } from '../../services/api';

export default function EmailAIPage() {
  const { config, updateConfigValue, handleSaveConfig, showToast } = useBot();
  const [activeMainTab, setActiveMainTab] = useState('ai_tools');
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cross-tab interaction: prefill reply from inbox match
  const [prefillReply, setPrefillReply] = useState(null);

  // Monitored responses
  const [analyzedResponses, setAnalyzedResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const loadResponsesData = async () => {
    setLoadingResponses(true);
    try {
      const data = await fetchResponses();
      if (Array.isArray(data)) setAnalyzedResponses(data);
    } catch (e) {
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    loadResponsesData();
  }, []);

  if (!config) {
    return <div className="text-slate-500 text-xs py-8 text-center">Loading AI and Email configurations...</div>;
  }

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await handleSaveConfig(config);
      showToast('AI and Email settings saved successfully', 'success');
    } catch (e) {
      showToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToReply = (replyData) => {
    setPrefillReply(replyData);
    setActiveMainTab('ai_tools');
    showToast(`Switched to Smart Reply for ${replyData.company || 'Recruiter'}!`, 'info');
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              AI Intelligence & Recruiter Inbox Hub
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Autonomous AI resume tailoring, recruiter reply drafter, screening Q&A solver, email applications & positive response alerts.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab('ai_tools')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
            activeMainTab === 'ai_tools'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>AI Intelligence Engine & Tools</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/30 text-white">
            Resume &bull; Reply &bull; Q&A
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('email_hub')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs font-bold transition cursor-pointer ${
            activeMainTab === 'email_hub'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Recruiter Inbox & Email Applications</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-white">
            Scanner &bull; Cold Apply &bull; +ve Alerts
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeMainTab === 'ai_tools' && (
        <AIToolsTab
          config={config}
          updateConfigValue={updateConfigValue}
          showToast={showToast}
          prefillReply={prefillReply}
        />
      )}

      {activeMainTab === 'email_hub' && (
        <EmailHubTab
          config={config}
          updateConfigValue={updateConfigValue}
          showToast={showToast}
          setIsGmailModalOpen={setIsGmailModalOpen}
          analyzedResponses={analyzedResponses}
          loadResponsesData={loadResponsesData}
          loadingResponses={loadingResponses}
          onSwitchToReply={handleSwitchToReply}
        />
      )}

      {/* Connect Gmail Modal */}
      <ConnectGmailModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        onConnected={() => {
          showToast('Gmail connected successfully!', 'success');
        }}
      />
    </div>
  );
}
