'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { t } from '@/lib/i18n';

const OPTIONS: Array<{ value: ThemePreference; icon: React.ElementType; label: string }> = [
  { value: 'light', icon: Sun, label: 'nav.light' },
  { value: 'dark', icon: Moon, label: 'nav.dark' },
  { value: 'system', icon: Monitor, label: 'nav.systemTheme' },
];

/**
 * Три режими одним рядком іконок: світла, темна, системна.
 *
 * Підсвічується `preference`, а не намальована тема, — інакше «системна»
 * виглядала б як «темна» і користувач не бачив би, що вибір узагалі є.
 * До монтування не підсвічуємо нічого: на сервері обраної теми ще не знати,
 * і будь-яка здогадка дала б стрибок підсвітки на першому кадрі.
 */
export default function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { preference, setPreference, mounted } = useTheme();

  return (
    <div className={`segmented ${className}`} role="group" aria-label={t('nav.theme')} data-tour="theme">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            title={t(label)}
            aria-label={t(label)}
            aria-pressed={active}
            /* px-0: три іконки мають вміститись у вузьку колонку панелі;
               центрування дає сам .segmented-item. */
            className={`segmented-item flex-1 px-0 ${active ? 'segmented-item-active' : ''}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
