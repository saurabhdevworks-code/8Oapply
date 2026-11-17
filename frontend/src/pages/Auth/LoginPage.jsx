import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import logoDark from '../../assets/logo-dark.png';
import { Lock, Mail, User, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-[390px] relative z-10">
        {/* Auth Card with all elements inside & compact proportions */}
        <div className="bg-[#0e1626] border border-slate-800/90 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
          {/* Brand & Logo Header Inside the Box */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center mb-1.5">
              <img src={logoDark} alt="8Oapply Logo" className="h-8 w-auto object-contain" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">
              {isRegister ? 'Create Your Account' : 'Welcome to 8Oapply'}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRegister
                ? 'Set up your isolated workspace, profile, and resume'
                : 'Sign in to access your autonomous job automation workspace'}
            </p>
          </div>

          {/* Smooth Rounded Sliding Pill Switch - Fitted with No Extra Space */}
          <div className="flex justify-center mb-4">
            <div className="relative inline-flex p-1 bg-[#080d17] rounded-full border border-slate-800 select-none">
              {/* Sliding Pill Indicator */}
              <div
                className={`absolute top-1 bottom-1 left-1 w-[124px] rounded-full bg-slate-800 border border-slate-700/60 shadow-sm transition-transform duration-200 ease-out pointer-events-none ${
                  isRegister ? 'translate-x-[124px]' : 'translate-x-0'
                }`}
              />
              {/* Tab Buttons fitted to content with zero dead space */}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                }}
                className={`relative z-10 w-[124px] py-1.5 text-xs font-semibold rounded-full text-center transition-colors duration-200 cursor-pointer ${
                  !isRegister ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                }}
                className={`relative z-10 w-[124px] py-1.5 text-xs font-semibold rounded-full text-center transition-colors duration-200 cursor-pointer ${
                  isRegister ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Saurabh Patel"
                    autoComplete="name"
                    required={isRegister}
                    className="w-full bg-[#080d17] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-[#080d17] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  className="w-full bg-[#080d17] border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required={isRegister}
                    className="w-full bg-[#080d17] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing</span>
                </>
              ) : (
                <span>{isRegister ? 'Register & Initialize Workspace' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {/* Footer isolation note */}
          <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Isolated User Workspace
            </span>
            <span className="font-mono text-slate-500 text-[10px]">PBKDF2-HMAC-SHA256</span>
          </div>
        </div>
      </div>
    </div>
  );
}
