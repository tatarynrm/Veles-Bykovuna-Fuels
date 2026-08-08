'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Clock } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { useGsap } from '@/shared/lib/useGsap';
import { PLATFORM_BLOCKS, TONE_VAR, TONE_SOFT } from '@/shared/config/expenses';
import { t } from '@/lib/i18n';

const LIVE = PLATFORM_BLOCKS.filter(block => block.status === 'live').length;
const PLANNED = PLATFORM_BLOCKS.length - LIVE;

/**
 * Можливості платформи в розрізі обліку.
 *
 * Числа в підзаголовку рахуються з масиву, а не вписані в переклад: інакше
 * додана інтеграція мовчки робила б підпис брехливим у десяти мовах одразу.
 * З тієї ж причини кожна картка носить статус — сторінка не має жодного
 * пункту, під яким немає або коду, або місця в дорожній карті.
 */
export default function PlatformGrid() {
  const sectionRef = useRef<HTMLElement>(null);

  useGsap(
    ({ gsap }) => {
      gsap.from('[data-block]', {
        autoAlpha: 0,
        y: 40,
        duration: 0.6,
        ease: 'power3.out',
        stagger: { each: 0.06, from: 'start' },
        scrollTrigger: { trigger: sectionRef.current, start: 'top 72%' },
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
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={t('landing.exp.platEyebrow')}
            title={t('landing.exp.platTitle')}
            description={t('landing.exp.platLead')}
            align="left"
          />

          <div className="flex gap-2">
            <span className="badge badge-success gap-1.5">
              <Check size={11} />
              <span data-numeric>{LIVE}</span> {t('landing.exp.statusLive')}
            </span>
            <span className="badge badge-neutral gap-1.5">
              <Clock size={11} />
              <span data-numeric>{PLANNED}</span> {t('landing.exp.statusPlanned')}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_BLOCKS.map(block => {
            const Icon = block.icon;
            const live = block.status === 'live';

            const body = (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                    style={{ background: TONE_SOFT[block.tone], color: TONE_VAR[block.tone] }}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${live ? 'badge-success' : 'badge-neutral'} gap-1`}>
                      {live ? <Check size={11} /> : <Clock size={11} />}
                      {t(live ? 'landing.exp.statusLive' : 'landing.exp.statusPlanned')}
                    </span>
                    {block.href && (
                      <ArrowUpRight size={15} style={{ color: 'var(--text-muted)' }} aria-hidden />
                    )}
                  </div>
                </div>

                <h3 className="mb-2 text-sm font-semibold leading-snug">{t(block.title)}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {t(block.desc)}
                </p>
              </>
            );

            /*
              Посилання ведуть у застосунок. Гість там не застрягне: сторінки
              за сесією самі відправлять його на /login, де публічний
              гостьовий вхід і надрукований.
            */
            return block.href ? (
              <Link
                key={block.id}
                href={block.href}
                data-block
                className="glass-panel glass-hover block p-5"
              >
                {body}
              </Link>
            ) : (
              <article key={block.id} data-block className="glass-panel p-5">
                {body}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
