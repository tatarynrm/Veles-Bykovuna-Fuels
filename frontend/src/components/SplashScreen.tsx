'use client';

import React, { useEffect, useState } from 'react';
import VelesLogo from './VelesLogo';
import { SPLASH_EVENT } from '@/lib/splashFlag';

const HOLD_MS = 2000;
const FADE_MS = 600;

type Phase = 'entering' | 'holding' | 'leaving' | 'gone';

function runSplash(set: (p: Phase) => void) {
  set('entering');
  setTimeout(() => {
    set('holding');
    setTimeout(() => {
      set('leaving');
      setTimeout(() => set('gone'), FADE_MS);
    }, HOLD_MS);
  }, 300);
}

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('gone');

  useEffect(() => {
    const handler = () => runSplash(setPhase);
    window.addEventListener(SPLASH_EVENT, handler);
    return () => window.removeEventListener(SPLASH_EVENT, handler);
  }, []);

  if (phase === 'gone') return null;

  const opacity = phase === 'leaving' ? 0 : 1;
  const scale = phase === 'entering' ? 0.88 : 1;
  const logoScale = phase === 'entering' ? 0.82 : 1;
  const logoOpacity = phase === 'entering' ? 0 : 1;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        opacity,
        transition: phase === 'leaving'
          ? `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`
          : 'none',
        pointerEvents: phase === 'leaving' ? 'none' : 'all',
        overflow: 'hidden',
      }}
    >
      {/* Aurora blobs — same pattern as body::before but more vivid for the splash */}
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          pointerEvents: 'none',
          background: [
            'radial-gradient(45% 55% at 20% 10%, var(--aurora-1), transparent 70%)',
            'radial-gradient(38% 44% at 82% 20%, var(--aurora-2), transparent 68%)',
            'radial-gradient(50% 48% at 60% 90%, var(--aurora-3), transparent 72%)',
          ].join(', '),
          filter: 'blur(32px)',
          animation: 'drift 20s ease-in-out infinite',
          scale,
          transition: 'scale 0.6s cubic-bezier(0.22,1,0.36,1)',
        }}
      />

      {/* Central glass card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0px',
          padding: '48px 56px 40px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid var(--glass-border)',
          borderRadius: '28px',
          boxShadow: [
            'inset 0 1px 0 var(--glass-highlight)',
            'var(--shadow-glass)',
            '0 0 80px -20px rgba(16,185,129,0.25)',
          ].join(', '),
          transform: `scale(${scale})`,
          transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            transition: [
              'opacity 0.45s cubic-bezier(0.22,1,0.36,1) 0.08s',
              'transform 0.55s cubic-bezier(0.22,1,0.36,1) 0.08s',
            ].join(', '),
          }}
        >
          <VelesLogo size={200} />
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: '28px',
            width: '120px',
            height: '2px',
            borderRadius: '9999px',
            background: 'var(--border-subtle)',
            overflow: 'hidden',
            opacity: phase === 'entering' ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: '9999px',
              background: 'var(--accent)',
              boxShadow: '0 0 10px var(--accent-glow)',
              animation: phase === 'holding'
                ? `splash-progress ${HOLD_MS}ms linear forwards`
                : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
