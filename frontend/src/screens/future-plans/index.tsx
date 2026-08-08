'use client';

import React, { useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Check, Clock } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { fadeUp, staggerParent, VIEWPORT, EASE_ENTER } from '@/shared/lib/motion';
import { useGsap } from '@/shared/lib/useGsap';
import { HORIZONS, REGULATORY, TONE_VAR, TONE_SOFT } from '@/shared/config/roadmap';
import { t } from '@/lib/i18n';

/*
  Хореографія горизонту, у тому ж дусі, що інфографіка «12 речей, які вже
  працюють»: не одна поява блоком, а каскад — маркер, іконка, текст, і лише
  тоді бейджі пунктів по черзі. staggerChildren на батьківському motion.div
  прошиває всю піддерево завдяки пропагації variants, тож дочірнім вузлам
  не треба своїх initial/whileInView.
*/
const horizonCascade: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const dotPop: Variants = {
  hidden: { opacity: 0, scale: 0.3 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE_ENTER } },
};

const iconPop: Variants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -10 },
  show: {
    opacity: 1, scale: 1, rotate: 0,
    transition: { delay: 0.08, duration: 0.5, ease: EASE_ENTER },
  },
};

const badgeGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.38 } },
};

const badgePop: Variants = {
  hidden: { opacity: 0, scale: 0.75, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: EASE_ENTER } },
};

export default function FuturePlansScreen() {
  const timelineRef = useRef<HTMLDivElement>(null);

  /*
    Вертикальна лінія — єдине, що лишається на GSAP: тільки scrub тримає її
    ріст синхронним зі швидкістю скролу, чого variants-переходами не досягти.
    scaleY анімується з transformOrigin: top — лінія росте згори вниз, а не
    розтягується від центру.
  */
  useGsap(
    ({ gsap }) => {
      gsap.fromTo(
        '[data-timeline-line]',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: {
            trigger: timelineRef.current,
            start: 'top 65%',
            end: 'bottom 75%',
            scrub: 0.4,
          },
        },
      );
    },
    timelineRef,
    [],
  );

  return (
    <>
      <section className="px-5 pb-16 pt-36 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow={t('landing.roadmapEyebrow')}
            title={t('landing.roadmapTitle')}
            description={t('landing.roadmapLead')}
            align="left"
            accent="warn"
          />
        </div>
      </section>

      {/* Горизонти */}
      <section ref={timelineRef} className="relative px-5 pb-28 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative pl-8 sm:pl-12">
            {/* Рейка таймлайна */}
            <div
              className="absolute left-[7px] top-2 w-px sm:left-[15px]"
              style={{ bottom: '2rem', background: 'var(--border-subtle)' }}
              aria-hidden
            />
            <div
              data-timeline-line
              className="absolute left-[7px] top-2 w-px sm:left-[15px]"
              style={{
                bottom: '2rem',
                background: 'linear-gradient(180deg,var(--accent),var(--info),var(--warn),var(--text-muted))',
              }}
              aria-hidden
            />

            {HORIZONS.map(h => {
              const Icon = h.icon;
              return (
                <motion.div
                  key={h.id}
                  data-horizon
                  className="relative mb-10 last:mb-0"
                  variants={horizonCascade}
                  initial="hidden"
                  whileInView="show"
                  viewport={VIEWPORT}
                >
                  {/* Маркер: вискакує з масштабу, тоді дихає кільцем, поки картка на екрані. */}
                  <motion.span
                    variants={dotPop}
                    className="absolute -left-8 top-1.5 flex h-3.5 w-3.5 items-center justify-center sm:-left-12"
                    aria-hidden
                  >
                    <motion.span
                      className="absolute h-3.5 w-3.5 rounded-full"
                      style={{ background: TONE_VAR[h.tone] }}
                      animate={{ opacity: [0.55, 0, 0.55], scale: [1, 2.4, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    />
                    <span
                      className="relative h-3.5 w-3.5 rounded-full border-2"
                      style={{
                        background: 'var(--bg-page)',
                        borderColor: TONE_VAR[h.tone],
                        boxShadow: `0 0 12px ${TONE_VAR[h.tone]}`,
                      }}
                    />
                  </motion.span>

                  <motion.article variants={fadeUp} className="glass-panel p-6">
                    <motion.span
                      variants={iconPop}
                      className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ background: TONE_SOFT[h.tone], color: TONE_VAR[h.tone] }}
                    >
                      <Icon size={20} />
                    </motion.span>

                    <p className="micro-label mb-2" style={{ color: TONE_VAR[h.tone] }}>
                      {t(h.phase)}
                    </p>
                    <h3 className="font-display mb-3 text-lg leading-snug">{t(h.title)}</h3>
                    <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {t(h.rationale)}
                    </p>

                    <motion.ul variants={badgeGroup} className="flex flex-wrap gap-2">
                      {h.items.map(item => (
                        <motion.li
                          key={item}
                          variants={badgePop}
                          className="rounded-lg px-2.5 py-1 text-[11px]"
                          style={{
                            background: 'var(--surface-inset)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {t(item)}
                        </motion.li>
                      ))}
                    </motion.ul>
                  </motion.article>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Регуляторні дати */}
      <section
        className="border-t px-5 py-28 sm:px-8"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow={t('landing.regulatoryEyebrow')}
            title={t('landing.regulatoryTitle')}
            description={t('landing.regulatoryLead')}
            accent="info"
            className="mb-14"
          />

          <motion.div
            variants={staggerParent(0.09)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="grid gap-4 sm:grid-cols-2"
          >
            {REGULATORY.map(r => (
              <motion.div key={r.title} variants={fadeUp} className="glass-panel flex gap-4 p-5">
                <motion.div
                  variants={iconPop}
                  className="relative flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{
                    background: r.active ? 'var(--accent-soft)' : 'var(--surface-inset)',
                    color: r.active ? 'var(--accent)' : 'var(--warn)',
                  }}
                >
                  {/* Пульсація лише на вже чинних нормах — «живе» зараз, а не «заплановане». */}
                  {r.active && (
                    <motion.span
                      className="absolute inset-0 rounded-xl"
                      style={{ background: 'var(--accent)' }}
                      animate={{ opacity: [0.35, 0, 0.35], scale: [1, 1.3, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                    />
                  )}
                  <span className="relative">
                    {r.active ? <Check size={16} /> : <Clock size={16} />}
                  </span>
                </motion.div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span
                      className="text-xs font-semibold"
                      data-numeric
                      style={{ color: r.active ? 'var(--accent)' : 'var(--warn)' }}
                    >
                      {r.date}
                    </span>
                    <h3 className="text-sm font-semibold">{t(r.title)}</h3>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(r.detail)}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
