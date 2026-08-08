'use client';

import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { useGsap } from '@/shared/lib/useGsap';
import { NORMALIZATIONS, TONE_VAR, TONE_SOFT } from '@/shared/config/expenses';
import { t } from '@/lib/i18n';

/**
 * Перетворення одиниць — найтихіша частина обліку й найдорожча помилка в ньому.
 *
 * Секція навмисно виглядає як конвеєр: рейка проростає разом зі скролом, а
 * картки виїжджають на неї по черзі. Стрілка «було → стало» — це буквально те,
 * що робить адаптер вендора, і робить рівно в одному місці.
 */
export default function NormalizationBand() {
  const sectionRef = useRef<HTMLElement>(null);

  useGsap(
    ({ gsap }) => {
      // Рейка малюється зліва направо — звідси transformOrigin.
      gsap.fromTo(
        '[data-norm-rail]',
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'bottom 80%',
            scrub: 0.4,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>('[data-norm]').forEach(card => {
        gsap.from(card, {
          autoAlpha: 0,
          y: 44,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 88%' },
        });
      });
    },
    sectionRef,
    [],
  );

  return (
    <section
      ref={sectionRef}
      className="border-t px-5 py-24 sm:px-8 sm:py-28"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow={t('landing.exp.normEyebrow')}
          title={t('landing.exp.normTitle')}
          description={t('landing.exp.normLead')}
          accent="info"
          align="left"
          className="mb-12"
        />

        {/* Рейка конвеєра */}
        <div className="relative mb-8 h-px" style={{ background: 'var(--border-subtle)' }} aria-hidden>
          <span
            data-norm-rail
            className="absolute inset-0 block origin-left"
            style={{
              background: 'linear-gradient(90deg,var(--accent),var(--info))',
              transform: 'scaleX(0)',
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NORMALIZATIONS.map(item => {
            const Icon = item.icon;
            return (
              <article key={item.id} data-norm className="glass-panel p-5">
                <span
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: TONE_SOFT[item.tone], color: TONE_VAR[item.tone] }}
                >
                  <Icon size={18} />
                </span>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className="glass-inset px-2.5 py-1 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t(item.from)}
                  </span>
                  <ArrowRight size={13} style={{ color: TONE_VAR[item.tone] }} aria-hidden />
                  <span
                    className="rounded-field px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: TONE_SOFT[item.tone], color: TONE_VAR[item.tone] }}
                  >
                    {t(item.to)}
                  </span>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(item.note)}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
