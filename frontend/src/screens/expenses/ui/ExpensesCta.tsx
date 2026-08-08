'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map } from 'lucide-react';
import { useScrollProgress } from '@/shared/lib/useScrollProgress';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import { appEntry } from '@/shared/config/site';
import { CTA_FRAMES, TONE_VAR, TONE_SOFT } from '@/shared/config/expenses';
import { t } from '@/lib/i18n';
import FrameSequence, { type FrameSequenceHandle } from './FrameSequence';

/** Скільки висоти сторінки «коштує» сцена: 5 екранів скролу на 4 кадри розкадровки. */
const SCENE_VH = 500;

/**
 * Частка прогресу, яку займає сама розкадровка. Останні 20% скролу тримають
 * останній кадр (звіт уже зібраний) і використовують той самий екран для
 * заклику до дії — так фінальна сцена стає й фоном для кнопок, а не просто
 * ще одним кадром.
 */
const VIDEO_SPAN = 0.8;

/** Скільки кадрів лежить у /public/frames/reports. */
const FRAME_COUNT = 100;
const FRAME_DIR = '/frames/reports';

/** Кадр-представник кожного епізоду — для нерухомої версії. */
const STILLS = [10, 32, 60, 95];
const still = (n: number) => `${FRAME_DIR}/${String(n).padStart(3, '0')}.jpg`;

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
 * Фінал сторінки: розкадровка «каністра → рахунки → чеки → звітність»,
 * синхронізована зі скролом.
 *
 * Кадри — окремі JPEG на канві, а не прокрутка відео по `currentTime`.
 * У вихідному ролику три ключові кадри на 470, тож кожна перемотка змушувала
 * декодер програти до трьохсот кадрів, а useScrollProgress міряє щокадру —
 * саме від цього сторінка й підвисала. Показ окремого кадру такої ціни не має.
 *
 * Текст під кожним епізодом лежить в одній клітинці ґріда й перемикається
 * `opacity`/`visibility` — той самий прийом кросфейду, що й у TripScene.
 * Через React проходить лише зміна епізоду (чотири рази на сцену); і сам
 * кадр, і смуга прогресу малюються повз стан.
 */
export default function ExpensesCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const framesRef = useRef<FrameSequenceHandle>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState(0);
  const [authed, setAuthed] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  const handleProgress = useCallback((progress: number) => {
    // Смуга прогресу й кадр — це стилі двох елементів, стану вони не потребують.
    if (railRef.current) railRef.current.style.transform = `scaleX(${progress})`;

    const storyProgress = Math.min(1, progress / VIDEO_SPAN);
    framesRef.current?.show(storyProgress);

    const next = progress >= VIDEO_SPAN
      ? CTA_FRAMES.length
      : Math.min(CTA_FRAMES.length - 1, Math.floor(storyProgress * CTA_FRAMES.length));
    setPhase(prev => (prev === next ? prev : next));
  }, []);

  useScrollProgress(sectionRef, handleProgress);

  /* Нерухома версія: ті самі епізоди — статичними кадрами, одним списком. */
  if (reduced) {
    return (
      <section className="px-5 py-24 text-center sm:px-8">
        <div className="mx-auto mb-14 grid max-w-4xl gap-6 text-left sm:grid-cols-2">
          {CTA_FRAMES.map((frame, i) => {
            const Icon = frame.icon;
            return (
              <div key={frame.id} className="glass-panel overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={still(STILLS[i])}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                <div className="flex gap-3 p-4">
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
        <FrameSequence
          ref={framesRef}
          count={FRAME_COUNT}
          dir={FRAME_DIR}
          className="absolute inset-0 h-full w-full"
        />
        {/*
          Пелена тут окрема від решти сторінки: кадри розкадровки — фотографічні,
          а не лінійна схема, тож інверсія світлої теми до них не застосовується.
          Щільність — по центру, бо текст стоїть саме там.
        */}
        <div className="absolute inset-0" style={{ background: 'var(--story-scrim)' }} />

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
