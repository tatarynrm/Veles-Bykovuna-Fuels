'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { fadeUp, staggerParent, VIEWPORT } from '@/shared/lib/motion';
import { useGsap } from '@/shared/lib/useGsap';
import { HORIZONS, REGULATORY, TONE_VAR } from '@/shared/config/roadmap';
import { useSectionSound } from '@/features/sound';
import { t } from '@/lib/i18n';

export default function FuturePlansScreen() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const regulatoryRef = useSectionSound<HTMLElement>();

  /*
    Вертикальна лінія малюється разом зі скролом, а картки горизонтів
    виїжджають по черзі. scaleY анімується з transformOrigin: top —
    так лінія росте згори вниз, а не розтягується від центру.
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

      gsap.utils.toArray<HTMLElement>('[data-horizon]').forEach(card => {
        gsap.from(card, {
          opacity: 0,
          y: 40,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 82%' },
        });
      });
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

            {HORIZONS.map(h => (
              <div key={h.id} data-horizon className="relative mb-10 last:mb-0">
                <span
                  className="absolute -left-8 top-1.5 h-3.5 w-3.5 rounded-full border-2 sm:-left-12"
                  style={{
                    background: 'var(--bg-page)',
                    borderColor: TONE_VAR[h.tone],
                    boxShadow: `0 0 12px ${TONE_VAR[h.tone]}`,
                  }}
                  aria-hidden
                />

                <article className="glass-panel p-6">
                  <p className="micro-label mb-2" style={{ color: TONE_VAR[h.tone] }}>
                    {t(h.phase)}
                  </p>
                  <h3 className="font-display mb-3 text-lg leading-snug">{t(h.title)}</h3>
                  <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(h.rationale)}
                  </p>

                  <ul className="flex flex-wrap gap-2">
                    {h.items.map(item => (
                      <li
                        key={item}
                        className="rounded-lg px-2.5 py-1 text-[11px]"
                        style={{
                          background: 'var(--surface-inset)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {t(item)}
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Регуляторні дати */}
      <section
        ref={regulatoryRef}
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
                <div
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
                  style={{
                    background: r.active ? 'var(--accent-soft)' : 'var(--surface-inset)',
                    color: r.active ? 'var(--accent)' : 'var(--warn)',
                  }}
                >
                  {r.active ? <Check size={16} /> : <Clock size={16} />}
                </div>
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
