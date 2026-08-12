'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, User, ArrowRight, ArrowLeft, AlertCircle, Loader2, Eye, CheckCircle2 } from 'lucide-react';
import VelesLogo from '@/components/VelesLogo';
import { API_BASE } from '@/lib/api';
import { t } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import { markSplashPending } from '@/lib/splashFlag';

const QUICK_LOGINS = [
  { user: 'admin', label: 'auth.administrator' },
  { user: 'okko', label: 'common.okko' },
  { user: 'shell', label: 'common.shell' },
];

/** Published on purpose — the guest role is read-only and enforced server-side. */
const GUEST_CREDENTIALS = { user: 'guest', password: 'guest' };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const submitLogin = async (login: string, pass: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: login, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('veles_token', data.token);
        localStorage.setItem('veles_user', JSON.stringify(data.user));
        markSplashPending();

        // 1. Вмикаємо екран успіху (ховаємо форму)
        setIsSuccess(true);

        // 2. Явно чекаємо 5 секунд (браузер встигне відмалювати новий стан)
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 3. І тільки після цього ініціюємо перехід
        router.push('/workflow/dashboard');
      } else {
        setError(data.message || t('auth.incorrectUsernamePassword'));
        setLoading(false);
      }
    } catch {
      setError(t('auth.noConnectionAuthenticationServer', { v0: API_BASE }));
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitLogin(username, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Мову і тему треба мати ще до входу: екран авторизації — це перше, що
          бачить користувач, і він не має бути ані чужою мовою, ані чужою темою. */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5">
        <ThemeToggleButton />
        <LanguageSwitcher />
      </div>

      {/* Вихід із форми входу без «назад» у браузері — на публічну головну. */}
      <Link
        href="/"
        className="btn btn-ghost absolute left-4 top-4 z-10 gap-1.5 px-3 py-2 text-xs"
      >
        <ArrowLeft size={13} />
        <span className="hidden sm:inline">{t('auth.backToHome')}</span>
      </Link>

      <div className="glass-panel rise w-full max-w-[400px] p-8">
        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <VelesLogo size={180} />
        </div>

        {isSuccess ? (
          /* Екран успішного входу, що відображається протягом 5 секунд */
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fadeIn">
            <CheckCircle2 className="mb-4 h-12 w-12 text-green-500 animate-bounce" />
            <h2 className="mb-2 text-lg font-medium text-txt-primary">
              {t('auth.loginSuccess')}
            </h2>
            <p className="text-xs text-txt-muted flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
              {t('auth.redirecting')}
            </p>
          </div>
        ) : (
          /* Форма входу */
          <>
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
                <span className="micro-label mb-1.5 block">{t('auth.username')}</span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('auth.enterYourUsername')}
                    autoComplete="username"
                    required
                    className="field field-lg pl-10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="micro-label mb-1.5 block">{t('auth.password')}</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-txt-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.enterYourPassword')}
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
                    {t('auth.signingInEllipsis')}
                  </>
                ) : (
                  <>
                    {t('auth.signIn')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Guest access — credentials are public, so they are printed here. */}
            <div className="hairline-t mt-7 pt-5">
              <button
                type="button"
                onClick={() => submitLogin(GUEST_CREDENTIALS.user, GUEST_CREDENTIALS.password)}
                disabled={loading}
                className="btn btn-ghost w-full py-2.5 text-xs"
              >
                <Eye className="h-4 w-4" />
                {t('auth.guestSignViewOnly')}
              </button>
              <p className="mt-2 text-center text-micro leading-relaxed text-txt-muted">
                {t('auth.login')} <span className="font-mono text-txt-secondary">guest</span> {t('auth.passwordFragment')}{' '}
                <span className="font-mono text-txt-secondary">guest</span>{t('auth.allDataAvailableViewing')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}