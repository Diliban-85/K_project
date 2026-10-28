import React, { useState } from 'react';
import { School, LogIn, UserPlus, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { TeacherUser } from '../types';

interface AuthViewProps {
  onLoginSuccess: (user: TeacherUser) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (mode === 'register') {
        setSuccessMessage('Account created successfully! Logging you in...');
      }

      // Store token in localStorage as backup for client fetch authorization header if needed
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Teacher@123');
    setMode('login');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
            <School className="h-7 w-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Teacher Portal
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Internal School Staff Assessment &amp; Class Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-slate-200 sm:px-10">
          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="inline-flex items-center space-x-1.5">
                <LogIn className="h-4 w-4" />
                <span>Teacher Login</span>
              </span>
            </button>
            <button
              id="auth-tab-register"
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="inline-flex items-center space-x-1.5">
                <UserPlus className="h-4 w-4" />
                <span>New Account</span>
              </span>
            </button>
          </div>

          {error && (
            <div
              id="auth-error-banner"
              className="mb-4 rounded-md bg-red-50 p-3 border border-red-200 text-sm text-red-700 flex items-start space-x-2"
            >
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-banner"
              className="mb-4 rounded-md bg-emerald-50 p-3 border border-emerald-200 text-sm text-emerald-700 flex items-start space-x-2"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Full Name &amp; Title
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  required
                  placeholder="e.g. Dr. Eleanor Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">
                School Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                required
                placeholder="teacher@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Password</label>
              <input
                id="auth-password-input"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">Minimum 6 characters</p>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-md bg-slate-900 py-2.5 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Sign In to Portal'
                : 'Create Teacher Account'}
            </button>
          </form>

          {/* Quick teacher credential picker to make testing seamless */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium mb-3">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              <span>Quick Test Credentials (Pre-seeded Teachers):</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <button
                type="button"
                id="quick-login-smith"
                onClick={() => handleQuickLogin('smith@school.edu')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-800">Teacher 1: Dr. Eleanor Smith</span>
                  <p className="text-[11px] text-slate-500 font-mono">smith@school.edu (Science)</p>
                </div>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  Select
                </span>
              </button>

              <button
                type="button"
                id="quick-login-johnson"
                onClick={() => handleQuickLogin('johnson@school.edu')}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-800">Teacher 2: Mr. Robert Johnson</span>
                  <p className="text-[11px] text-slate-500 font-mono">johnson@school.edu (Math)</p>
                </div>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  Select
                </span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 text-center">
              Password for all pre-seeded accounts: <code className="font-mono">Teacher@123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
