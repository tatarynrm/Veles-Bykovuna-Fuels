'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, GraduationCap, X } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import { t } from '@/lib/i18n';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Padding around the highlighted element, in px. */
const HALO = 8;
const CARD_WIDTH = 320;
const GAP = 16;

/**
 * The sidebar is rendered twice — a desktop rail (`hidden lg:block`) and a mobile
 * drawer — so a selector matches two nodes. Take the first one that is actually
 * laid out; a `display:none` copy measures 0×0 and would spotlight the corner.
 */
function findVisibleTarget(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    nodes.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/**
 * Guided tour of the navigation. Offered once per browser on first login; after
 * that it is started from the «Навчання» button in the sidebar.
 *
 * The spotlight is a single positioned box with a huge outer shadow — one element,
 * no blur layer, so it never fights the glass surfaces underneath.
 */
export default function OnboardingTour() {
  const pathname = usePathname();
  const {
    steps,
    stepIndex,
    isRunning,
    isPrompting,
    nextStep,
    prevStep,
    endTour,
    acceptPrompt,
    declinePrompt,
  } = useTour();

  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const step = isRunning ? steps[stepIndex] : undefined;

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);

    const el = findVisibleTarget(step.target);
    if (!el) return setRect(null);

    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!isRunning) return;

    const el = step?.target ? findVisibleTarget(step.target) : null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    measure();
    // The smooth scroll above finishes after this tick — re-measure once it settles.
    const settle = setTimeout(measure, 320);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isRunning, step, measure]);

  /* Keyboard: Esc ends, arrows move. */
  useEffect(() => {
    if (!isRunning) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isRunning, endTour, nextStep, prevStep]);

  useEffect(() => {
    if (isRunning) cardRef.current?.focus();
  }, [isRunning, stepIndex]);

  if (!mounted || pathname === '/login') return null;

  /* ── invitation ──────────────────────────────────────────────────────────── */
  if (isPrompting) {
    return createPortal(
      <div
        className="fade-in fixed inset-0 z-[900] flex items-center justify-center bg-black/55 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-invite-title"
      >
        <div className="glass-float animate-pop w-full max-w-[380px] rounded-panel p-6 text-center">
          <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel bg-accent-soft text-accent">
            <GraduationCap className="h-5 w-5" />
          </span>
          <h2 id="tour-invite-title" className="text-base font-semibold text-txt-primary">
            {t('tour.showMeHowWorksQuestion')}
          </h2>
          <p className="mt-2 text-2xs leading-relaxed text-txt-secondary">
            {t('tour.shortTourMenuAbout')}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={declinePrompt} className="btn btn-ghost justify-center">
              {t('tour.notNow')}
            </button>
            <button onClick={acceptPrompt} className="btn btn-primary justify-center">
              {t('tour.startTheTour')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!isRunning || !step) return null;

  /* ── running tour ────────────────────────────────────────────────────────── */
  const isLast = stepIndex === steps.length - 1;

  // Prefer a card to the right of the spotlight (the menu lives on the left);
  // fall back to below it, and to dead centre when nothing could be measured.
  const viewportW = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight;

  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(CARD_WIDTH, viewportW - 32),
    };
  } else {
    const fitsRight = rect.left + rect.width + GAP + CARD_WIDTH < viewportW - 8;
    const left = fitsRight
      ? rect.left + rect.width + GAP
      : Math.max(16, Math.min(rect.left, viewportW - CARD_WIDTH - 16));
    const rawTop = fitsRight ? rect.top - 8 : rect.top + rect.height + GAP;
    const top = Math.max(16, Math.min(rawTop, viewportH - 240));

    cardStyle = { top, left, width: Math.min(CARD_WIDTH, viewportW - 32) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[900]" role="dialog" aria-modal="true">
      {/* Spotlight: one box, its shadow dims everything else. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-field ring-2 ring-accent/70 transition-all duration-300 ease-enter"
          style={{
            top: rect.top - HALO,
            left: rect.left - HALO,
            width: rect.width + HALO * 2,
            height: rect.height + HALO * 2,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/60" />
      )}

      {/* Click-away ends the tour, matching the modal convention elsewhere. */}
      <button
        type="button"
        aria-label={t('tour.finishTheTour')}
        onClick={endTour}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div
        ref={cardRef}
        tabIndex={-1}
        className="glass-float animate-pop absolute rounded-card p-4 outline-none"
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="badge badge-accent">
            <GraduationCap className="h-3 w-3" />
            {t('common.training')}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular font-mono text-micro text-txt-muted">
              {stepIndex + 1} / {steps.length}
            </span>
            <button
              onClick={endTour}
              className="btn-icon h-7 w-7"
              title={t('tour.finishTheTour')}
              aria-label={t('tour.finishTheTour')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-txt-primary">{t(step.title)}</h3>
        <p className="mt-1.5 text-2xs leading-relaxed text-txt-secondary">{t(step.body)}</p>

        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={endTour} className="btn btn-ghost px-2 text-micro">
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="btn btn-ghost px-2"
              aria-label={t('tour.previousStep')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={nextStep} className="btn btn-primary">
              {isLast ? (
                <>
                  {t('tour.finish')}
                  <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  {t('tour.next')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
