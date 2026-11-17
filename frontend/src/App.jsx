import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BotProvider } from './context/BotContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import { Loader2 } from 'lucide-react';

import DashboardPage from './pages/Dashboard/DashboardPage';
import PlatformsPage from './pages/Platforms/PlatformsPage';
import TargetsPage from './pages/Targets/TargetsPage';
import HistoryPage from './pages/History/HistoryPage';
import SchedulerPage from './pages/Scheduler/SchedulerPage';
import EmailAIPage from './pages/EmailAI/EmailAIPage';
import ProfilePage from './pages/Profile/ProfilePage';
import SettingsPage from './pages/Settings/SettingsPage';

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <span className="text-xs font-mono tracking-wider text-slate-400">Loading Session</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <BotProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="platforms" element={<PlatformsPage />} />
            <Route path="targets" element={<TargetsPage />} />
            <Route path="responses" element={<Navigate to="/history" replace />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="scheduler" element={<SchedulerPage />} />
            <Route path="email-ai" element={<EmailAIPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="appearance" element={<Navigate to="/settings?tab=appearance" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BotProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
