'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, SkipForward } from 'lucide-react';
import { plural, t } from '@/lib/i18n';
import { useScrollProgress } from '@/shared/lib/useScrollProgress';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import { EASE_ENTER } from '@/shared/lib/motion';
import { CAPABILITIES, TONE_VAR, TONE_SOFT } from '@/shared/config/capabilities';
import { useSectionSound, useSound } from '@/features/sound';
import CapabilityScene from './scenes/CapabilityScene';

const COUNT = CAPABILITIES.length;
/** Скільки висоти екрана «коштує» перехід між сусідніми пунктами. */
const SCROLL_PER_SLIDE = 55;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Дванадцять можливостей як горизонтальна стрічка.
 *
 * Два різні механізми, бо один не працює всюди:
 *
 * • Десктоп — секція вища за екран, вміст тримається на `position: sticky`, а
 *   вертикальна прокрутка перемикає слайд. Перехід дискретний, а не
 *   безперервний: у слайда є колонка тексту, і його треба читати, а не
 *   ловити поглядом у русі.
 *
 * • Дотик — рідна горизонтальна прокрутка зі snap. Перехоплювати скрол на
 *   телефоні означає воювати з інерцією та адресним рядком, що ховається;
 *   свайп там і так природний жест.
 *
 * Заголовок рахує довжину масиву, тож новий пункт змінює і число, і
 * знаменник лічильника, і кількість слайдів — правити нічого не треба.
 */
export default function Capabilities() {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reduced = usePrefersReducedMotion();
  const soundRef = useSectionSound<HTMLDivElement>();
  const { play } = useSound();

  /*
    Зсув рахується в пікселях від виміряної ширини, а не у відсотках:
    відсоток у translateX рахується від ширини самої стрічки, а вона у
    COUNT разів ширша за слайд, тож будь-яка відсоткова арифметика тут
    ламається щоразу, коли змінюється кількість пунктів.
  */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setSlideWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleProgress = useCallback(
    (progress: number) => {
      const next = Math.min(COUNT - 1, Math.max(0, Math.round(progress * (COUNT - 1))));
      if (next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
      play('tick');
    },
    [play],
  );

  useScrollProgress(sectionRef, handleProgress);

  // На дотикових екранах активний слайд визначає рідна прокрутка.
  const onTrackScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || isDesktop || !slideWidth) return;
    const next = Math.min(COUNT - 1, Math.round(el.scrollLeft / slideWidth));
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }, [isDesktop, slideWidth]);

  const skip = () => {
    play('whoosh');
    document.getElementById('fleet-day')?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const heading = plural(COUNT, {
    one: 'landing.capCountOne',
    few: 'landing.capCountFew',
    many: 'landing.capCountMany',
    other: 'landing.capCountOther',
  });

  return (
    <section
      ref={sectionRef}
      id="capabilities"
      className="relative"
      style={
        // Мобільна висота — за вмістом: там прокрутка горизонтальна й рідна.
        isDesktop
          ? { height: `calc(${(COUNT - 1) * SCROLL_PER_SLIDE}vh + 100vh)` }
          : undefined
      }
    >
      <div
        ref={soundRef}
        className={isDesktop ? 'sticky top-0 flex h-screen flex-col justify-center' : ''}
      >
        {/* Шапка */}
        <div className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 lg:pt-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="micro-label mb-2" style={{ color: 'var(--accent)' }}>
                {t('landing.capabilitiesEyebrow')}
              </p>
              <h2 className="font-display text-[26px] leading-[1.15] sm:text-[32px]">
                {heading}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="font-display text-sm tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {pad(index + 1)} / {pad(COUNT)}
              </span>
              <button
                type="button"
                onClick={skip}
                className="btn btn-ghost gap-1.5 px-3 py-2 text-xs"
              >
                <SkipForward size={13} />
                {t('landing.skipAll')}
              </button>
            </div>
          </div>

          {/* Смуга прогресу — і індикатор, і навігація */}
          <div className="mb-8 flex gap-1" role="tablist" aria-label={t('landing.capabilitiesAria')}>
            {CAPABILITIES.map((cap, i) => (
              <button
                key={cap.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t(cap.title)}
                onClick={() => {
                  indexRef.current = i;
                  setIndex(i);
                  play('tick');
                  if (!isDesktop && trackRef.current) {
                    trackRef.current.scrollTo({ left: i * slideWidth, behavior: 'smooth' });
                  }
                }}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{
                  background: i <= index ? TONE_VAR[cap.tone] : 'var(--surface-hover)',
                }}
              />
            ))}
          </div>
        </div>

        {/*
          Стрічка.

          Обрізання — на внутрішньому елементі, а не на тому, що з падінгами:
          overflow ріже по padding-box, тож із класами на одному вузлі
          наступний слайд просвічував у бічних відступах.
        */}
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div ref={viewportRef} className={isDesktop ? 'overflow-hidden' : ''}>
          {/*
            Рухається стрічка цілком, а не кожен слайд окремо: інакше на кожен
            перехід стартує COUNT анімацій замість однієї.

            На дотику transform лишається нульовим — там елемент є рідним
            контейнером прокрутки, і зсув конфліктував би зі snap.
          */}
          <motion.div
            ref={trackRef}
            onScroll={onTrackScroll}
            animate={{ x: isDesktop && slideWidth ? -index * slideWidth : 0 }}
            transition={{ duration: reduced ? 0 : 0.55, ease: EASE_ENTER }}
            className={
              isDesktop
                ? 'flex'
                : 'flex snap-x snap-mandatory overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            }
          >
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              const activeSlide = i === index;
              return (
                <div key={cap.id} className="w-full flex-none snap-center">
                  <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
                    {/* Опис */}
                    <div className="order-2 lg:order-1">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                          style={{ background: TONE_SOFT[cap.tone], color: TONE_VAR[cap.tone] }}
                        >
                          <Icon size={21} />
                        </span>
                        <h3 className="font-display text-lg leading-tight sm:text-xl">
                          {t(cap.title)}
                        </h3>
                      </div>

                      <p
                        className="mb-5 text-sm leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t(cap.long)}
                      </p>

                      <ul className="space-y-2.5">
                        {cap.points.map(point => (
                          <li key={point} className="flex gap-2.5 text-xs leading-relaxed">
                            <ChevronRight
                              size={13}
                              className="mt-0.5 flex-none"
                              style={{ color: TONE_VAR[cap.tone] }}
                            />
                            <span style={{ color: 'var(--text-secondary)' }}>{t(point)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Інфографіка */}
                    <div className="glass-panel order-1 p-4 sm:p-6 lg:order-2">
                      <CapabilityScene
                        id={cap.id}
                        active={activeSlide}
                        tone={TONE_VAR[cap.tone]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
        </div>

        {/* Підказка про жест — лише там, де вона доречна */}
        {!isDesktop && (
          <p className="px-5 pb-16 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('landing.swipeHint')}
          </p>
        )}
      </div>
    </section>
  );
}
