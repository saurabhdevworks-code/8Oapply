import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useBot } from '../../context/BotContext';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

export default function AppLayout() {
  const { toast } = useBot();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans max-w-full overflow-x-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen min-w-0 max-w-[calc(100vw-16rem)] overflow-x-hidden">
        <Header />

        <main className="flex-1 p-3.5 md:px-6 md:py-3.5 overflow-y-auto min-w-0 max-w-full flex flex-col">
          <Outlet />
        </main>
      </div>

      {/* Toast Notification - Sleek Compact Rounded Pill on Top Right */}
      {toast && (
        <div className="fixed top-5 right-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-800 shadow-md animate-in fade-in slide-in-from-top-2 duration-150">
          {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          {toast.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
          <span className="text-xs font-medium tracking-tight">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
