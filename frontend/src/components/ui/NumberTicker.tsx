'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface NumberTickerProps {
  value: number;
  /** Count-up length in ms. */
  duration?: number;
  /** Held before the count starts — use to stagger a row of tiles. */
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Replaces the default uk-UA grouping formatter (e.g. formatCurrency). */
  format?: (value: number) => string;
  className?: string;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts up to `value` once the element scrolls into view, and re-animates from
 * whatever is currently on screen whenever `value` changes — so a filter change
 * reads as the number moving, not as a flash of new content.
 *
 * Always tabular so the digits do not jitter while counting.
 */
export default function NumberTicker({
  value,
  duration = 900,
  delay = 0,
  decimals = 0,
  prefix,
  suffix,
  format,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(0);
  const [display, setDisplay] = useState(0);
  const [inView, setInView] = useState(false);

  const formatter = useMemo(() => {
    if (format) return format;
    const nf = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (n: number) => nf.format(n);
  }, [format, decimals]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;

    if (reducedMotion() || duration <= 0) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }

    const from = currentRef.current;
    const delta = value - from;
    if (delta === 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    let start = 0;

    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      // easeOutExpo — fast commit, long settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = from + delta * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else currentRef.current = value;
    };

    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [inView, value, duration, delay]);

  return (
    <span ref={ref} className={cn('tabular', className)}>
      {prefix}
      {formatter(display)}
      {suffix}
    </span>
  );
}
