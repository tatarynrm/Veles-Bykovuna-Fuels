'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Fuel, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

const QUICK_LOGINS = [
  { user: 'admin', label: 'Адміністратор' },
  { user: 'okko', label: 'ОККО' },
  { user: 'shell', label: 'Shell' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('veles_token', data.token);
        localStorage.setItem('veles_user', JSON.stringify(data.user));
        router.push('/');
      } else {
        setError(data.message || 'Неправильне імʼя користувача або пароль');
      }
    } catch {
      setError(`Немає звʼязку з сервером авторизації (${API_BASE})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="glass-panel rise w-full max-w-[400px] p-8">
        {/* Brand */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-panel bg-accent-sheen shadow-accent-glow">
            <Fuel className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-txt-primary">
            VELES <span className="text-accent">ERP</span>
          </h1>
          <p className="mt-1 text-2xs text-txt-muted">
            Інтегрована система обліку палива · OKKO · Shell · Ruptela
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-field border border-[color:var(--danger)]/25 bg-[var(--danger-soft)] p-3 text-2xs text-danger"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="micro-label mb-1.5 block">Імʼя користувача</span>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введіть логін"
                autoComplete="username"
                required
                className="field field-lg pl-10"
              />
            </div>
          </label>

          <label className="block">
            <span className="micro-label mb-1.5 block">Пароль</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введіть пароль"
                autoComplete="current-password"
                required
                className="field field-lg pl-10"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Авторизація…
              </>
            ) : (
              <>
                Увійти в систему
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="hairline-t mt-7 pt-5">
          <p className="micro-label mb-2.5 text-center">Швидкий вхід</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LOGINS.map((q) => (
              <button
                key={q.user}
                type="button"
                onClick={() => {
                  setUsername(q.user);
                  setPassword('');
                }}
                className="btn btn-ghost justify-center py-2 text-micro"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
