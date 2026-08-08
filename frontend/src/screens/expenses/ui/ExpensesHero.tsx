'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Map } from 'lucide-react';
import { useGsap } from '@/shared/lib/useGsap';
import { blurUp, staggerParent, EASE_ENTER } from '@/shared/lib/motion';
import { appEntry } from '@/shared/config/site';
import { t } from '@/lib/i18n';
import SchemeVideo from './SchemeVideo';

/** Заголовок розбитий на слова — кожне виїжджає окремо. У масиві КЛЮЧІ. */
const TITLE_WORDS = [
  'landing.exp.heroWord0',
  'landing.exp.heroWord1',
  'landing.exp.heroWord2',
  'landing.exp.heroWord3',
];

const CHIPS = ['landing.exp.chip0', 'landing.exp.chip1', 'landing.exp.chip2'];

/**
 * Шапка сторінки: фура в русі — сам рейс, з якого потім і розкладаються
 * витрати. Розділення «туди/назад» бере на себе TripScene нижче, тут потрібен
 * лише рух: сторінка про рейс має починатися з рейсу, а не зі стоп-кадру.
 *
 * Кліп зациклений, тому знятий як проїзд камери поруч із машиною: фура тримає
 * своє місце в кадрі, а швидкість дають смуги світла, що летять повз. Якщо
 * колись міняти ролик — брати такий самий, де машина не виїжджає за край,
 * інакше на стику циклу буде помітний стрибок.
 */
export default function ExpensesHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  // Кадр їде повільніше за текст і трохи наїжджає — та сама механіка, що на головній.
  useGsap(
    ({ gsap }) => {
      gsap.to(videoWrapRef.current, {
        yPercent: 14,
        scale: 1.08,
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
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      <div ref={videoWrapRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
        {/* Єдиний ролик на сторінці, який вантажиться одразу: це перший екран. */}
        <SchemeVideo
          src="/videos/main_expenese_video.mp4"
          eager
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'var(--scheme-video-filter)' }}
        />
        {/* Пелена залежить від теми — саме вона тримає контраст заголовка. */}
        <div className="absolute inset-0" style={{ background: 'var(--scheme-scrim)' }} />
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{ background: 'var(--scheme-fade)' }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-32 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, ease: EASE_ENTER }}
          className="micro-label mb-5"
          style={{ color: 'var(--accent)' }}
        >
          {t('landing.exp.heroEyebrow')}
        </motion.p>

        <motion.h1
          variants={staggerParent(0.13, 0.28)}
          initial="hidden"
          animate="show"
          className="font-display mb-7 max-w-3xl text-[38px] leading-[1.08] sm:text-[52px] lg:text-[58px]"
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
          className="mb-9 max-w-[540px] text-base leading-[1.78]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('landing.exp.heroLead')}
        </motion.p>

        <motion.div
          variants={staggerParent(0.08, 1.1)}
          initial="hidden"
          animate="show"
          className="mb-10 flex flex-wrap gap-2"
        >
          {CHIPS.map(key => (
            <motion.span
              key={key}
              variants={blurUp}
              className="glass-inset rounded-full px-3.5 py-1.5 text-[11px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t(key)}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, ease: EASE_ENTER }}
          className="flex flex-wrap gap-3"
        >
          <Link href={appEntry(authed)} className="btn btn-primary gap-2 px-6 py-3 text-sm">
            {authed ? t('landing.openDashboard') : t('landing.signInToSystem')}
            <ArrowRight size={15} />
          </Link>
          <Link href="/future-plans" className="btn btn-ghost gap-2 px-6 py-3 text-sm">
            <Map size={14} />
            {t('landing.navRoadmap')}
          </Link>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 9, 0], opacity: [0.35, 0.8, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-2"
        aria-hidden
      >
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {t('landing.exp.scrollHint')}
        </span>
        <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
      </motion.div>
    </section>
  );
}
