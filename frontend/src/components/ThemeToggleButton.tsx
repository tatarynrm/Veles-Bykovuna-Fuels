'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { t } from '@/lib/i18n';

/** Порядок обходу по кліку: світла → темна → системна → світла. */
const NEXT: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICON: Record<ThemePreference, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const TITLE: Record<ThemePreference, string> = {
  light: 'common.switchDarkTheme',
  dark: 'common.switchSystemTheme',
  system: 'common.switchLightTheme',
};

/**
 * Одна кнопка на три режими — для топбарів, де ряд із трьох кнопок не влазить.
 * Іконка показує ПОТОЧНИЙ режим, підказка — наступний, тому «системна» видно
 * як окремий стан, а не як випадково темну тему.
 */
export default function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { preference, setPreference, mounted } = useTheme();
  // До монтування обраний режим ще невідомий — показуємо нейтральний монітор,
  // щоб іконка не стрибала на першому кадрі.
  const shown: ThemePreference = mounted ? preference : 'system';
  const Icon = ICON[shown];

  return (
    <button
      type="button"
      onClick={() => setPreference(NEXT[shown])}
      className={`btn-icon ${className}`}
      title={t(TITLE[shown])}
      aria-label={t(TITLE[shown])}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
