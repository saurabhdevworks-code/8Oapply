import React, { useState, useEffect } from 'react';
import {
  fetchResponses,
  fetchResponseMetrics,
  updateResponseRecord,
  checkInboxForResponses,
  generateAIMessage,
} from '../../services/api';
import { useBot } from '../../context/BotContext';
import CustomSelect from '../../components/common/CustomSelect';
import {
  MailCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  ExternalLink,
  BellRing,
  AlertCircle,
  FileEdit,
  X,
  Sparkles,
} from 'lucide-react';

const STATUS_OPTIONS = [
  'Applied',
  'Under Review',
  'Assessment (OA)',
  'Interview Scheduled',
  'Offer',
  'Rejected',
];

export default function ResponsesPage() {
  const { config, showToast } = useBot();
  const [responses, setResponses] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, positive: 0, applied: 0, under_review: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingItem, setEditingItem] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);

  const handleGenerateAIReply = async () => {
    if (!editingItem) return;
    setGeneratingReply(true);
    const prov = (config?.ai_provider || 'grok').toLowerCase();
    const apiKey = config?.[`${prov}_api_key`] || config?.ai_api_key || '';
    try {
      const res = await generateAIMessage({
        provider: prov,
        api_key: apiKey,
        model: config?.ai_model || '',
        job_title: editingItem.job_title || 'Software Engineer',
        company: editingItem.company || 'Company',
        message_type: 'interview_reply',
        recruiter_snippet: editingItem.email_snippet || editingItem.notes || 'Interview invitation',
      });
      if (res && res.content) {
        setEditNotes((prev) => (prev ? `${prev}\n\n--- AI Drafted Reply ---\n${res.content}` : res.content));
        showToast(`AI reply drafted using ${prov.toUpperCase()}`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'AI generation failed', 'error');
    } finally {
      setGeneratingReply(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [resps, mets] = await Promise.all([
        fetchResponses().catch(() => []),
        fetchResponseMetrics().catch(() => ({ total: 0, positive: 0 })),
      ]);
      setResponses(resps || []);
      setMetrics(mets);
    } catch (err) {
      console.error('Failed to load response data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScanInbox = async () => {
    setScanning(true);
    try {
      const res = await checkInboxForResponses();
      if (res.status === 'success') {
        showToast(
          `Scanned ${res.scanned} emails: ${res.positive_detected} +ve response(s) identified. Alerts dispatched!`,
          'success'
        );
      } else {
        showToast(res.message || 'Inbox scan complete', 'info');
      }
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to scan inbox', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateResponseRecord(id, newStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditNotes(item.notes || '');
    setEditDate(item.interview_date || '');
  };

  const saveEditModal = async () => {
    if (!editingItem) return;
    try {
      await updateResponseRecord(editingItem.id, editingItem.status, editNotes, editDate || null);
      showToast('Notes and timeline updated', 'success');
      setEditingItem(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to save updates', 'error');
    }
  };

  const filteredResponses = responses.filter((r) => {
    const matchesSearch =
      (r.company && r.company.toLowerCase().includes(search.toLowerCase())) ||
      (r.job_title && r.job_title.toLowerCase().includes(search.toLowerCase())) ||
      (r.sender_email && r.sender_email.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'POSITIVE'
        ? ['Assessment (OA)', 'Interview Scheduled', 'Offer'].includes(r.status)
        : r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    if (status === 'Interview Scheduled' || status === 'Offer') {
      return 'bg-emerald-950 text-emerald-400 border border-emerald-800';
    }
    if (status === 'Assessment (OA)') {
      return 'bg-sky-950 text-sky-400 border border-sky-800';
    }
    if (status === 'Rejected') {
      return 'bg-red-950 text-red-400 border border-red-800';
    }
    if (status === 'Under Review') {
      return 'bg-amber-950 text-amber-400 border border-amber-800';
    }
    return 'bg-neutral-800 text-neutral-300 border border-neutral-700';
  };

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Top Header - No Background Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-1">
        <div className="flex items-center gap-3">
          <MailCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Recruiter Response & Pipeline Dashboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Monitors incoming recruiter emails. Positive responses (Interviews/OAs) automatically trigger instant email alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleScanInbox}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <BellRing className={`w-3.5 h-3.5 ${scanning ? 'animate-bounce' : ''}`} />
            {scanning ? 'Scanning Inbox' : 'Scan Recruiter Inbox'}
          </button>
        </div>
      </div>

      {/* Metric Cards - Flat Enterprise */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900">
          <div className="text-[11px] font-medium text-neutral-400">Total Tracked</div>
          <div className="text-xl font-bold text-neutral-100 font-mono mt-0.5">{metrics.total}</div>
        </div>
        <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900">
          <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Positive (+ve) Invites
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{metrics.positive}</div>
        </div>
        <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900">
          <div className="text-[11px] font-medium text-neutral-400">Under Review</div>
          <div className="text-xl font-bold text-neutral-100 font-mono mt-0.5">{metrics.under_review}</div>
        </div>
        <div className="p-3.5 rounded border border-neutral-800 bg-neutral-900">
          <div className="text-[11px] font-medium text-neutral-400">Rejections</div>
          <div className="text-xl font-bold text-neutral-400 font-mono mt-0.5">{metrics.rejected}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, role, or recruiter email..."
            className="w-full pl-8 pr-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 placeholder-neutral-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            icon={Filter}
            className="!bg-neutral-900 !border-neutral-800 !text-neutral-200 hover:!border-neutral-700"
            menuClassName="!bg-neutral-900 !border-neutral-800"
            options={[
              { value: 'ALL', label: `All Statuses (${responses.length})` },
              { value: 'POSITIVE', label: `Positive Responses (${metrics.positive})` },
              ...STATUS_OPTIONS.map((st) => ({ value: st, label: st })),
            ]}
          />
        </div>
      </div>

      {/* Flat Data Table */}
      <div className="rounded border border-neutral-800 bg-neutral-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-medium select-none">
                <th className="py-2.5 px-3.5">Company</th>
                <th className="py-2.5 px-3.5">Job Role</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Response Timeline</th>
                <th className="py-2.5 px-3.5">Recruiter Notes / Snippet</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    Loading response records...
                  </td>
                </tr>
              ) : filteredResponses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-500">
                    No response records found. Click "Scan Recruiter Inbox" to check for incoming replies.
                  </td>
                </tr>
              ) : (
                filteredResponses.map((item) => {
                  const isPositive = ['Assessment (OA)', 'Interview Scheduled', 'Offer'].includes(
                    item.status
                  );
                  return (
                    <tr key={item.id} className="hover:bg-neutral-800/40 transition">
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                          {item.company || 'Unknown'}
                          {isPositive && (
                            <Sparkles
                              className="w-3.5 h-3.5 text-emerald-400 shrink-0"
                              title="+ve Response Triggered Alert"
                            />
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {item.platform || 'Direct'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-neutral-200 max-w-xs truncate">
                        {item.job_title || 'Software Engineer'}
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <select
                          value={item.status || 'Applied'}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st} className="bg-neutral-900 text-neutral-200">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3.5 whitespace-nowrap text-neutral-400 font-mono text-[11px]">
                        <div>Applied: {item.applied_date || '—'}</div>
                        {item.last_response_date && (
                          <div className="text-neutral-300">Reply: {item.last_response_date}</div>
                        )}
                        {item.interview_date && (
                          <div className="text-emerald-400 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {item.interview_date}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 max-w-sm text-neutral-300 text-[11px]">
                        {item.email_snippet ? (
                          <div className="truncate font-mono text-[10px] text-neutral-400 bg-neutral-950 p-1 rounded border border-neutral-800">
                            {item.email_snippet}
                          </div>
                        ) : item.notes ? (
                          <div className="truncate text-neutral-300">{item.notes}</div>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <FileEdit className="w-3 h-3 text-neutral-400" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Details Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-neutral-100">
                {editingItem.company} — Response Record
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingItem.email_snippet && (
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Detected Email Snippet
                </label>
                <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-neutral-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {editingItem.email_snippet}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                Interview / Assessment Date
              </label>
              <input
                type="text"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                placeholder="e.g. 2026-11-20 15:00 or Next Tuesday"
                className="w-full px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-neutral-400">
                  Candidate Notes & Response Draft
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAIReply}
                  disabled={generatingReply}
                  className="flex items-center gap-1 text-[10px] text-neutral-300 hover:text-white px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className={`w-3 h-3 text-neutral-400 ${generatingReply ? 'animate-spin' : ''}`} />
                  {generatingReply ? 'Drafting...' : 'AI Draft Reply'}
                </button>
              </div>
              <textarea
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Paste Calendly links, test keys, or click AI Draft Reply to draft a response..."
                className="w-full px-2.5 py-1.5 rounded bg-neutral-950 border border-neutral-800 focus:border-neutral-600 focus:outline-none text-xs text-neutral-200 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveEditModal}
                className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
