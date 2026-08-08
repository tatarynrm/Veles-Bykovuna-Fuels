'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Fuel, Zap, ShieldCheck } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { fadeUp, staggerParent, VIEWPORT } from '@/shared/lib/motion';
import { t } from '@/lib/i18n';

const STEPS = [
  { icon: Fuel,       step: '01', title: 'landing.step1Title', desc: 'landing.step1Desc', tone: 'var(--accent)' },
  { icon: Zap,        step: '02', title: 'landing.step2Title', desc: 'landing.step2Desc', tone: 'var(--warn)' },
  { icon: ShieldCheck, step: '03', title: 'landing.step3Title', desc: 'landing.step3Desc', tone: 'var(--info)' },
];

export default function HowItWorks() {
  return (
    <section
      className="border-t px-5 py-28 sm:px-8"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow={t('landing.howEyebrow')}
          title={t('landing.howTitle')}
          accent="info"
          className="mb-16"
        />

        <motion.div
          variants={staggerParent(0.14)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="relative grid gap-6 md:grid-cols-3"
        >
          {/* Лінія звʼязку між кроками — лише на десктопі, де вони в ряд. */}
          <div
            className="absolute left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] top-8 hidden h-px md:block"
            style={{ background: 'linear-gradient(90deg,transparent,var(--border-strong),transparent)' }}
            aria-hidden
          />

          {STEPS.map(s => {
            const Icon = s.icon;
            return (
              <motion.div key={s.step} variants={fadeUp} className="glass-panel flex flex-col gap-4 p-6">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                    style={{ background: 'var(--surface-inset)', color: s.tone }}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className="mt-2.5 text-[11px] font-semibold"
                    style={{ color: s.tone, letterSpacing: '0.1em' }}
                  >
                    {s.step}
                  </span>
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold">{t(s.title)}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {t(s.desc)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
