'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map } from 'lucide-react';
import { useScrollProgress } from '@/shared/lib/useScrollProgress';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import { appEntry } from '@/shared/config/site';
import { CTA_FRAMES, TONE_VAR, TONE_SOFT } from '@/shared/config/expenses';
import { t } from '@/lib/i18n';

/** Скільки висоти сторінки «коштує» сцена: 5 екранів скролу на 4 кадри ролика. */
const SCENE_VH = 500;

/**
 * Частка прогресу, яку займає сам ролик. Останні 20% скролу тримають відео на
 * останньому кадрі (звіт уже зібраний) і використовують той самий екран для
 * заклику до дії — так фінальна сцена рахунків стає й фоном для кнопок, а не
 * просто ще одним кадром розкадровки.
 */
const VIDEO_SPAN = 0.8;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function CtaButtons({ authed }: { authed: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Link href={appEntry(authed)} className="btn btn-primary gap-2 px-6 py-3 text-sm">
        {authed ? t('landing.openDashboard') : t('landing.signInToSystem')}
        <ArrowRight size={15} />
      </Link>
      <Link href="/future-plans" className="btn btn-ghost gap-2 px-6 py-3 text-sm">
        <Map size={14} />
        {t('landing.navRoadmap')}
      </Link>
    </div>
  );
}

/**
 * Фінал сторінки: розкадровка ролика `fules-reports.mp4` (каністра заливає
 * пальне → рахунки → чеки → звітність), синхронізована зі скролом.
 *
 * Відео не грає само — `currentTime` виставляється прямо з прогресу скролу
 * (`progress / VIDEO_SPAN * duration`), тож кадр на екрані завжди відповідає
 * тому, що людина щойно прогорнула, а не циклу програвання. Текст під кожним
 * кадром лежить в одній клітинці ґріда й перемикається `opacity`/`visibility`
 * — той самий прийом кросфейду, що й у TripScene, тільки тут по чотирьох
 * кадрах відео, а не по двох роликах.
 */
export default function ExpensesCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const staticRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState(0);
  const [authed, setAuthed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  const handleProgress = useCallback((progress: number) => {
    if (railRef.current) railRef.current.style.transform = `scaleX(${progress})`;

    const video = videoRef.current;
    const videoProgress = Math.min(1, progress / VIDEO_SPAN);
    if (video && Number.isFinite(video.duration)) {
      video.currentTime = videoProgress * video.duration;
    }

    const next = progress >= VIDEO_SPAN
      ? CTA_FRAMES.length
      : Math.min(CTA_FRAMES.length - 1, Math.floor(videoProgress * CTA_FRAMES.length));
    setPhase(prev => (prev === next ? prev : next));
  }, []);

  useScrollProgress(sectionRef, handleProgress);

  /* Нерухома версія: відео грає звичайним циклом, усі кадри — одним списком. */
  if (reduced) {
    return (
      <section ref={staticRef} className="px-5 py-24 text-center sm:px-8">
        <div className="mx-auto mb-14 max-w-3xl overflow-hidden rounded-card">
          <video
            src="/videos/fules-reports.mp4"
            autoPlay muted loop playsInline preload="metadata" aria-hidden
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>

        <div className="mx-auto mb-14 grid max-w-4xl gap-6 text-left sm:grid-cols-2">
          {CTA_FRAMES.map(frame => {
            const Icon = frame.icon;
            return (
              <div key={frame.id} className="glass-inset flex gap-3 p-4">
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{ background: TONE_SOFT[frame.tone], color: TONE_VAR[frame.tone] }}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug">{t(frame.title)}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(frame.detail)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mx-auto max-w-3xl">
          <h2 className="font-display mb-5 text-[28px] leading-[1.14] sm:text-[36px]">
            {t('landing.exp.ctaTitle')}
          </h2>
          <p className="mx-auto mb-9 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('landing.exp.ctaLead')}
          </p>
          <CtaButtons authed={authed} />
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative" style={{ height: `${SCENE_VH}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <video
          ref={videoRef}
          src="/videos/fules-reports.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'var(--scheme-video-filter)' }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--scheme-scrim)' }} />

        {/* Прогрес розкадровки */}
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: 'var(--border-subtle)' }} aria-hidden>
          <span
            ref={railRef}
            className="block h-full origin-left"
            style={{ background: 'var(--accent)', transform: 'scaleX(0)' }}
          />
        </div>

        <div className="relative z-10 mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-5 text-center sm:px-8">
          {phase < CTA_FRAMES.length && (
            <span className="micro-label mb-5" style={{ color: 'var(--accent)' }} data-numeric>
              {pad(phase + 1)} / {pad(CTA_FRAMES.length)}
            </span>
          )}

          <div className="grid w-full" style={{ gridTemplateAreas: '"stack"' }}>
            {CTA_FRAMES.map((frame, i) => {
              const Icon = frame.icon;
              const active = phase === i;
              return (
                <div
                  key={frame.id}
                  style={{
                    gridArea: 'stack',
                    opacity: active ? 1 : 0,
                    visibility: active ? 'visible' : 'hidden',
                    transition: 'opacity 500ms ease',
                  }}
                >
                  <span
                    className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: TONE_SOFT[frame.tone], color: TONE_VAR[frame.tone] }}
                  >
                    <Icon size={22} />
                  </span>
                  <h2 className="font-display mb-3 text-[26px] leading-[1.16] sm:text-[34px]">
                    {t(frame.title)}
                  </h2>
                  <p className="mx-auto max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(frame.detail)}
                  </p>
                </div>
              );
            })}

            <div
              style={{
                gridArea: 'stack',
                opacity: phase === CTA_FRAMES.length ? 1 : 0,
                visibility: phase === CTA_FRAMES.length ? 'visible' : 'hidden',
                transition: 'opacity 500ms ease',
              }}
            >
              <h2 className="font-display mb-5 text-[28px] leading-[1.14] sm:text-[36px]">
                {t('landing.exp.ctaTitle')}
              </h2>
              <p className="mx-auto mb-9 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {t('landing.exp.ctaLead')}
              </p>
              <CtaButtons authed={authed} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
