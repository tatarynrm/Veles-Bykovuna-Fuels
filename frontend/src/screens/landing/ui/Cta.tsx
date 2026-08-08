'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fadeUp, staggerParent, VIEWPORT } from '@/shared/lib/motion';
import { t } from '@/lib/i18n';

export default function Cta() {
  return (
    <section className="px-5 py-36 sm:px-8">
      <motion.div
        variants={staggerParent(0.09)}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="mx-auto max-w-2xl text-center"
      >
        <motion.p variants={fadeUp} className="micro-label mb-5" style={{ color: 'var(--text-muted)' }}>
          {t('landing.ctaEyebrow')}
        </motion.p>

        <motion.h2 variants={fadeUp} className="font-display mb-5 text-[32px] leading-[1.12] sm:text-[40px]">
          {t('landing.ctaTitle')}
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="mb-12 text-sm leading-[1.75]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('landing.ctaLead')}
        </motion.p>

        <motion.div variants={fadeUp} className="relative inline-flex flex-wrap justify-center gap-3">
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-2xl"
            style={{ background: 'radial-gradient(ellipse,var(--accent-glow),transparent 70%)' }}
            aria-hidden
          />
          <Link
            href="/login"
            className="btn btn-primary relative gap-2 px-8 py-3.5 text-sm"
          >
            {t('landing.signInToSystem')}
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/future-plans"
            className="btn btn-ghost relative gap-2 px-8 py-3.5 text-sm"
          >
            {t('landing.ctaRoadmap')}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
