'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Activity } from 'lucide-react';
import { useGsap } from '@/shared/lib/useGsap';
import { blurUp, staggerParent, EASE_ENTER } from '@/shared/lib/motion';
import { appEntry } from '@/shared/config/site';
import { t } from '@/lib/i18n';
import { HERO_VIDEOS, useHeroVideos } from '../model/useHeroVideos';

/*
  Заголовок розбитий на слова, бо кожне виїжджає окремо. У масиві лежать
  КЛЮЧІ: t() на рівні модуля застряг би мовою, активною під час імпорту.
*/
const TITLE_WORDS = [
  'landing.heroWord0',
  'landing.heroWord1',
  'landing.heroWord2',
  'landing.heroWord3',
];

/** Цифри ілюстративні — це вітрина, тому вони не в словнику. */
const KPI_PREVIEW = [
  { label: 'landing.kpiSpend',  value: '₴2.84M', delta: '▲ 4.2%', positive: true },
  { label: 'landing.kpiCards',  value: '147',    delta: '+12',    positive: true },
  { label: 'landing.kpiTx',     value: '3 291',  delta: 'landing.kpiThisMonth', positive: null },
  { label: 'landing.kpiOnline', value: '43/67',  delta: '64%',    positive: null },
];

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const videoIndex = useHeroVideos();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  // Відео їде повільніше за контент — класичний паралакс на скрабі.
  useGsap(
    ({ gsap }) => {
      gsap.to(videoWrapRef.current, {
        yPercent: 16,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    },
    sectionRef,
    [],
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      <div ref={videoWrapRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
        {HERO_VIDEOS.map((src, i) => (
          <motion.video
            key={src}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'var(--hero-video-filter)' }}
            animate={{ opacity: videoIndex === i ? 1 : 0 }}
            transition={{ duration: 2.5, ease: 'easeInOut' }}
          />
        ))}
        {/* Пелена залежить від теми — саме вона тримає контраст заголовка. */}
        <div className="absolute inset-0" style={{ background: 'var(--hero-scrim)' }} />
        <div className="absolute inset-x-0 bottom-0 h-64" style={{ background: 'var(--hero-fade)' }} />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-16 px-5 pb-24 pt-32 sm:px-8 lg:grid-cols-[1fr_400px]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ease: EASE_ENTER }}
            className="micro-label mb-5"
            style={{ color: 'var(--accent)' }}
          >
            {t('landing.heroEyebrow')}
          </motion.p>

          <motion.h1
            variants={staggerParent(0.13, 0.28)}
            initial="hidden"
            animate="show"
            className="font-display mb-7 text-[38px] leading-[1.08] sm:text-[52px] lg:text-[58px]"
          >
            {TITLE_WORDS.map(key => (
              <motion.span key={key} variants={blurUp} className="mr-[0.22em] inline-block">
                {t(key)}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, ease: EASE_ENTER }}
            className="mb-10 max-w-[440px] text-base leading-[1.78]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('landing.heroLead')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, ease: EASE_ENTER }}
            className="flex flex-wrap gap-3"
          >
            <Link href={appEntry(authed)} className="btn btn-primary gap-2 px-6 py-3 text-sm">
              {authed ? t('landing.openDashboard') : t('landing.signInToSystem')}
              <ArrowRight size={15} />
            </Link>
            <Link href="/integrations" className="btn btn-ghost gap-2 px-6 py-3 text-sm">
              {t('landing.navIntegrations')}
              <ChevronDown size={14} />
            </Link>
          </motion.div>
        </div>

        {/* Превʼю дашборда. Цифри ілюстративні — це вітрина, не живі дані. */}
        <motion.div
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.7, ease: EASE_ENTER }}
          className="hidden lg:block"
        >
          <div className="glass-panel mb-3 p-5">
            <p className="micro-label mb-4" style={{ color: 'var(--text-muted)' }}>
              {t('landing.liveDashboard')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {KPI_PREVIEW.map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.12 }}
                  className="glass-inset rounded-xl p-3"
                >
                  <p className="mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t(kpi.label)}
                  </p>
                  <p className="text-base font-semibold" data-numeric>{kpi.value}</p>
                  <p
                    className="mt-0.5 text-[11px]"
                    style={{ color: kpi.positive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {/* Дельти на кшталт «▲ 4.2%» — не текст, перекладу не потребують. */}
                    {kpi.delta.startsWith('landing.') ? t(kpi.delta) : kpi.delta}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="glass-panel ml-8 flex items-center gap-3 px-4 py-3.5"
          >
            <span
              className="h-2 w-2 flex-none rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent-glow)' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{t('landing.liveTrackTitle')}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('landing.liveTrackNote')}
              </p>
            </div>
            <Activity size={14} style={{ color: 'var(--accent)' }} />
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 9, 0], opacity: [0.35, 0.8, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        aria-hidden
      >
        <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />
      </motion.div>
    </section>
  );
}
