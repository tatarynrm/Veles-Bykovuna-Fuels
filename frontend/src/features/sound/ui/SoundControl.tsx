'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { useSound } from '../model/SoundContext';
import { t } from '@/lib/i18n';

/**
 * Кнопка звуку для маркетингових топбарів.
 *
 * Меню — у портал на body, як і в LanguageSwitcher: топбар має backdrop-filter,
 * а він створює containing block, через який fixed-позиціонування всередині
 * поводиться не так, як очікується.
 */
export default function SoundControl({ className = '' }: { className?: string }) {
  const { enabled, volume, unlocked, awaitingGesture, setEnabled, setVolume, play } = useSound();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const Icon = !enabled ? VolumeX : volume < 0.34 ? Volume1 : Volume2;
  const label = enabled ? t('landing.soundOn') : t('landing.soundOff');

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn-icon relative"
        title={label}
        aria-label={label}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" />
        {/* Крапка означає «дозволено, але браузер чекає на перший клік». */}
        {awaitingGesture && (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--warn)' }}
          />
        )}
      </button>

      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="glass-float animate-pop fixed z-[600] w-64 rounded-2xl p-4"
            style={{ top: pos.top, right: pos.right }}
            role="dialog"
            aria-label={t('landing.soundSettings')}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="micro-label" style={{ color: 'var(--text-muted)' }}>
                {t('landing.sound')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => { setEnabled(!enabled); if (!enabled) play('confirm'); }}
                className="relative h-5 w-9 rounded-full transition-colors duration-200"
                style={{ background: enabled ? 'var(--accent)' : 'var(--surface-hover)' }}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full transition-transform duration-200"
                  style={{
                    background: enabled ? 'var(--accent-contrast)' : 'var(--text-muted)',
                    transform: enabled ? 'translateX(18px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {t('landing.volume', { v0: Math.round(volume * 100) })}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                disabled={!enabled}
                onChange={e => setVolume(Number(e.target.value) / 100)}
                onMouseUp={() => enabled && play('tick')}
                className="w-full accent-[var(--accent)] disabled:opacity-40"
                aria-label={t('landing.volumeAria')}
              />
            </label>

            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {!enabled
                ? t('landing.soundMuted')
                : awaitingGesture
                  ? t('landing.soundAwaiting')
                  : unlocked
                    ? t('landing.soundActive')
                    : t('landing.soundPreparing')}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
