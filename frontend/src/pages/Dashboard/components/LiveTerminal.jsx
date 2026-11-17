import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Trash2, Copy, ArrowDownCircle, Check } from 'lucide-react';
import { fetchRecentLogs } from '../../../services/api';

export default function LiveTerminal() {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef(null);

  useEffect(() => {
    fetchRecentLogs(100)
      .then((data) => {
        if (data && data.logs) {
          setLogs(data.logs.map((l) => l.trim()));
        }
      })
      .catch((err) => console.error('Failed to load logs:', err));
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/logs/stream');

    eventSource.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data);
        if (line) {
          setLogs((prev) => [...prev.slice(-400), line]);
        }
      } catch (e) {
        if (event.data) {
          setLogs((prev) => [...prev.slice(-400), event.data]);
        }
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = () => setLogs([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLogLine = (line) => {
    let color = 'text-slate-600';
    if (line.includes('INFO')) color = 'text-slate-700';
    if (line.includes('WARNING') || line.includes('⚠️')) color = 'text-amber-600 font-semibold';
    if (line.includes('ERROR') || line.includes('❌') || line.includes('Exception')) color = 'text-rose-600 font-bold';
    if (line.includes('Saved:') || line.includes('Applied') || line.includes('✅')) color = 'text-emerald-700 font-bold';
    if (line.includes('🔍 Combo')) color = 'text-slate-900 font-semibold';
    return <span className={color}>{line}</span>;
  };

  return (
    <div className="rounded-[10px] border border-neutral-800 bg-neutral-950 overflow-hidden flex flex-col h-[420px]">
      {/* Terminal Title Bar */}
      <div className="h-9 bg-neutral-900 border-b border-neutral-800 px-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-xs font-mono text-neutral-300">
            Runtime Output (8Oapply log)
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            [{logs.length} lines]
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[11px] px-2 py-0.5 rounded transition ${
              autoScroll
                ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Auto-scroll
          </button>
          <button
            onClick={handleCopy}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
            title="Copy logs"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            onClick={handleClear}
            className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title="Clear view"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 p-3 font-mono text-[11px] leading-4 overflow-y-auto space-y-0.5 select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-600 text-xs">
            Awaiting process output. Start the bot to stream logs.
          </div>
        ) : (
          logs.map((line, idx) => (
            <div key={idx} className="whitespace-pre-wrap break-all px-1 py-0.5 rounded hover:bg-neutral-900/50">
              {formatLogLine(line)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
