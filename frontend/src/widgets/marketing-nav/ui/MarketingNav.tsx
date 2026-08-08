'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import ThemeToggleButton from '@/components/ThemeToggleButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { MARKETING_NAV, BRAND, appEntry } from '@/shared/config/site';
import { t } from '@/lib/i18n';
import { EASE_ENTER } from '@/shared/lib/motion';

export default function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  // Поки шапка над hero-відео — вона прозора; далі стає склом. Інакше
  // світлий скрим шапки ріже кадр рівно по верхньому краю.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Маршрут змінився — шухляда має закритись, інакше вона лишається поверх
  // нової сторінки.
  useEffect(() => setMenuOpen(false), [pathname]);

  const entry = appEntry(authed);

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_ENTER }}
        className="fixed inset-x-0 top-0 z-50"
        style={{
          background: scrolled ? 'var(--nav-scrim)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'var(--glass-border)' : 'transparent'}`,
          transition: 'background 240ms var(--ease-state), border-color 240ms var(--ease-state)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label={BRAND.legal}>
            <span
              className="font-display text-sm font-bold"
              style={{ color: 'var(--accent)', letterSpacing: '0.14em' }}
            >
              {BRAND.name}
            </span>
            <span aria-hidden style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="hidden text-[11px] sm:inline" style={{ color: 'var(--text-muted)' }}>
              {BRAND.tagline}
            </span>
          </Link>

          {/* Десктопні посилання */}
          <div className="hidden items-center gap-1 md:flex">
            {MARKETING_NAV.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative rounded-control px-3 py-2 text-xs font-medium transition-colors"
                  style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {t(item.label)}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-2 -bottom-0.5 h-px"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggleButton />
            <LanguageSwitcher />
            <Link
              href={entry}
              className="btn btn-primary ml-1 hidden items-center gap-1.5 px-4 py-2 text-xs sm:flex"
            >
              {authed ? t('landing.dashboard') : t('landing.signIn')}
              <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="btn-icon md:hidden"
              aria-label={menuOpen ? t('landing.closeMenu') : t('landing.openMenu')}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Мобільна шухляда */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'var(--overlay)' }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_ENTER }}
              className="glass-float mx-4 mt-20 rounded-panel p-4"
              onClick={e => e.stopPropagation()}
            >
              {MARKETING_NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-control px-3 py-3 text-sm font-medium"
                  style={{
                    color: pathname === item.href ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  {t(item.label)}
                </Link>
              ))}
              <Link
                href={entry}
                className="btn btn-primary mt-3 w-full justify-center py-3 text-sm"
              >
                {authed ? t('landing.openDashboard') : t('landing.signInToSystem')}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
