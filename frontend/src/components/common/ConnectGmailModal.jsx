import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, AlertCircle, X, ExternalLink, ShieldCheck, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { connectGmail, disconnectGmail, fetchGmailStatus } from '../../services/api';
import { useBot } from '../../context/BotContext';
import ScallopBadge from './ScallopBadge';

export default function ConnectGmailModal({ isOpen, onClose, onConnected }) {
  const { config, updateConfigValue, handleSaveConfig, showToast } = useBot();
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState({ connected: false, email: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetchGmailStatus();
      setStatus(res);
      if (res.email) setEmail(res.email);
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      loadStatus();
      if (config?.recipient_email) {
        setRecipientEmail(config.recipient_email);
      } else {
        setRecipientEmail('');
      }
    }
  }, [isOpen, config?.recipient_email]);

  if (!isOpen) return null;

  const handleConnect = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await connectGmail(email, appPassword);
      setSuccessMsg(res.message || 'Gmail connected successfully! Recruiter inbox scanning is now active.');
      setStatus({ connected: true, email: email.trim() });
      setAppPassword('');
      if (onConnected) onConnected(res);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to authenticate with Gmail. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this Gmail account? Automatic status tracking from emails will pause.')) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await disconnectGmail();
      setStatus({ connected: false, email: '' });
      setEmail('');
      setSuccessMsg('Gmail disconnected.');
      if (onConnected) onConnected();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    const finalRecipient = recipientEmail.trim();
    if (updateConfigValue) {
      updateConfigValue('recipient_email', finalRecipient);
    }
    if (handleSaveConfig && config) {
      try {
        await handleSaveConfig({ ...config, recipient_email: finalRecipient });
      } catch (err) {
        console.error('Failed to save alerts destination:', err);
      }
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700/60 shadow-xs">
              <svg className="w-4.5 h-4.5" viewBox="0 49.4 512 399.42">
                <path fill="#4285F4" d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z" />
                <path fill="#34A853" d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z" />
                <path fill="#FBBC05" d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z" />
                <path fill="#EA4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
                <path fill="#C5221F" d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-1.5">
                Connect Gmail
                {status.connected && (
                  <ScallopBadge connected={true} className="w-4 h-4" />
                )}
              </h3>
              <p className="text-[11px] text-neutral-400">
                Automate status tracking directly from recruiter replies & interview invites.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {status.connected && !errorMsg ? (
            <div className="space-y-4">
              {/* Account Status Card */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-neutral-200">Gmail Connected & Syncing</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">
                    Active
                  </span>
                </div>

                <div className="text-xs text-neutral-200 font-mono bg-neutral-900 px-3 py-2 rounded border border-neutral-800 flex items-center justify-between">
                  <span>{status.email}</span>
                  <ScallopBadge connected={true} className="w-4 h-4" />
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  8Oapply automatically checks your inbox every 15 minutes. When recruiter emails (interview requests, coding assessments, or status updates) arrive, application statuses in your Application Records update automatically.
                </p>
              </div>

              {/* Alerts Destination Setting */}
              <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-200">
                    Alerts Destination
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {recipientEmail.trim() ? 'Custom Recipient' : 'Same as Gmail'}
                  </span>
                </div>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={status.email || config?.smtp_user || "your.email@gmail.com"}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-100 placeholder-neutral-500 font-mono"
                />
                <p className="text-[11px] text-neutral-500">
                  Enter where alert emails and interview notifications should be delivered. If left blank, alerts are sent to your connected Gmail.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="text-xs text-rose-400 hover:text-rose-300 transition cursor-pointer"
                >
                  Disconnect Account
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Gmail Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-100 placeholder-neutral-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-neutral-300">
                    Google App Password (16-character)
                  </label>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 transition"
                  >
                    Generate Key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="abcd efgh ijkl mnop"
                    className="w-full pl-3 pr-10 py-2 rounded-lg bg-neutral-950 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-100 placeholder-neutral-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step-by-step guidance */}
              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 text-[11px] space-y-1.5 text-neutral-400">
                <div className="font-semibold text-neutral-300 flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-teal-400" />
                  Quick 30-Second Setup:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-0.5">
                  <li>Go to <span className="text-neutral-300 font-medium">Google Account &gt; Security &gt; 2-Step Verification</span></li>
                  <li>Scroll to the bottom to <span className="text-neutral-300 font-medium">App Passwords</span></li>
                  <li>Enter app name <span className="text-emerald-400 font-medium">8Oapply</span> and click <span className="text-neutral-300 font-medium">Create</span></li>
                  <li>Copy the 16 letters and paste them above</li>
                </ol>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email || !appPassword}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {loading ? 'Verifying Inbox' : 'Connect Gmail & Scan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
