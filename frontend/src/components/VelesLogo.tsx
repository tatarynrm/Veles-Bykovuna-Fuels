'use client';

import React from 'react';

interface VelesLogoProps {
  /** Width in px; height scales proportionally (ratio ≈ 1.9:1). */
  size?: number;
  /** When true, hides the text row and renders only the chevron mark. */
  markOnly?: boolean;
  className?: string;
}

/**
 * VB mark: a geometric chevron derived from the original logo's tire-tread V.
 * Uses CSS custom-property colors so it follows both dark and light themes.
 */
export default function VelesLogo({ size = 220, markOnly = false, className = '' }: VelesLogoProps) {
  const w = size;
  const h = markOnly ? Math.round(size * 0.65) : Math.round(size * 1.1);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 220 ${markOnly ? 144 : 242}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Veles Bukovyna Fuels"
      role="img"
    >
      <defs>
        {/* Emerald radial glow behind the mark */}
        <radialGradient id="vb-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
        {/* Gradient for the chevron arms */}
        <linearGradient id="vb-arm-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="vb-arm-r" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="vb-blur-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Ambient glow disk ── */}
      <ellipse cx="110" cy="65" rx="90" ry="70" fill="url(#vb-glow)" />

      {/* ── VB Chevron Mark ── */}
      {/* Left V arm – thick bar */}
      <path
        d="M18 12 L85 138 L110 98 L135 138 L202 12"
        stroke="url(#vb-arm-l)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#vb-blur-glow)"
      />
      {/* Left V arm – crisp overlay */}
      <path
        d="M18 12 L85 138 L110 98 L135 138 L202 12"
        stroke="#10B981"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Tread marks (horizontal cross-bars through each arm) ── */}
      {/* Left arm — bars perpendicular to the arm direction */}
      <line x1="28"  y1="30"  x2="50"  y2="30"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="39"  y1="52"  x2="62"  y2="52"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="52"  y1="76"  x2="74"  y2="76"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="63"  y1="98"  x2="83"  y2="98"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      {/* Right arm */}
      <line x1="137" y1="98"  x2="157" y2="98"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="148" y1="76"  x2="168" y2="76"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="159" y1="52"  x2="181" y2="52"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <line x1="170" y1="30"  x2="192" y2="30"  stroke="#10B981" strokeWidth="5" strokeLinecap="round" opacity="0.45" />

      {/* ── Bottom accent line (mirrors the brand bar in the original logo) ── */}
      <line x1="18" y1="148" x2="202" y2="148" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />

      {/* ── Text block (hidden in markOnly mode) ── */}
      {!markOnly && (
        <>
          {/* VELES BUKOVYNA */}
          <text
            x="110"
            y="180"
            textAnchor="middle"
            fontFamily="'Inter var', 'Inter', system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="26"
            letterSpacing="0.12em"
            fill="#ECF1F8"
          >
            VELES BUKOVYNA
          </text>
          {/* FUELS – accent color */}
          <text
            x="110"
            y="210"
            textAnchor="middle"
            fontFamily="'Inter var', 'Inter', system-ui, -apple-system, sans-serif"
            fontWeight="600"
            fontSize="13"
            letterSpacing="0.28em"
            fill="#10B981"
          >
            FUELS
          </text>
          {/* Decorative side lines flanking FUELS */}
          <line x1="18" y1="205" x2="76" y2="205" stroke="#10B981" strokeWidth="1" opacity="0.4" />
          <line x1="144" y1="205" x2="202" y2="205" stroke="#10B981" strokeWidth="1" opacity="0.4" />
        </>
      )}
    </svg>
  );
}
