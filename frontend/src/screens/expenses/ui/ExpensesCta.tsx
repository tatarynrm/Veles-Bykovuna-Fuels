'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map } from 'lucide-react';
import { useGsap } from '@/shared/lib/useGsap';
import { appEntry } from '@/shared/config/site';
import { t } from '@/lib/i18n';
import { usePlayInView } from '../model/usePlayInView';

/**
 * Фінал сторінки. Кадр «назад» тут доречний саме тому, що рейс закінчився:
 * фура повертається, і разом із нею — цифри, заради яких усе рахувалося.
 */
export default function ExpensesCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const [authed, setAuthed] = useState(false);

  usePlayInView(sectionRef);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('veles_token'));
  }, []);

  useGsap(
    ({ gsap }) => {
      gsap.fromTo(
        videoWrapRef.current,
        { yPercent: -8, scale: 1.14 },
        {
          yPercent: 8,
          scale: 1.06,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    },
    sectionRef,
    [],
  );

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <div ref={videoWrapRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
        <video
          src="/videos/truck-scheme-to-left.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="h-full w-full object-cover"
          style={{ filter: 'var(--scheme-video-filter)' }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--scheme-scrim)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-32 text-center sm:px-8">
        <h2 className="font-display mb-5 text-[28px] leading-[1.14] sm:text-[36px]">
          {t('landing.exp.ctaTitle')}
        </h2>
        <p
          className="mx-auto mb-9 max-w-xl text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('landing.exp.ctaLead')}
        </p>

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
      </div>
    </section>
  );
}
