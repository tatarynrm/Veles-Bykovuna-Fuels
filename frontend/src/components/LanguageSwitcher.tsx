'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import Flag from './Flag';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n';

interface LanguageSwitcherProps {
  /**
   * `compact` — кнопка з випадним списком (топбар, футер панелі, екран входу).
   * `segmented` — чотири коди в ряд; займає всю ширину, тож лишився для місць,
   * де вибір мови стоїть окремим блоком.
   */
  variant?: 'compact' | 'segmented';
  /** З якого краю кнопки вирівняти меню. */
  align?: 'left' | 'right';
  /** Бажаний напрям розкриття. Якщо місця немає — меню перевернеться саме. */
  direction?: 'down' | 'up';
  className?: string;
}

const MENU_WIDTH = 224; // w-56
/*
  Приблизна висота меню — потрібна лише для вибору боку розкриття.
  Десять мов у список уже не вміщаються на невисоких екранах, тому саме меню
  обмежене по висоті й прокручується; тут же тримаємо ту саму стелю, щоб
  вибір «вгору чи вниз» рахувався від реального розміру.
*/
const MENU_HEIGHT = 420;
const GAP = 8; // відступ між кнопкою і меню
const VIEWPORT_PAD = 8; // щоб меню не притискалось до краю екрана

/** На сервері useLayoutEffect попереджає в консоль — там достатньо useEffect. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Меню малюється в <body> через портал, а не поруч із кнопкою.
 *
 * Абсолютне позиціювання ламалось у бічній панелі: вона має
 * `overflow-y-auto overflow-x-hidden`, тож список унизу панелі або обрізався,
 * або розтягував її прокрутку. Портал + `position: fixed` виносять меню з-під
 * будь-якого overflow, і той самий компонент однаково працює в топбарі, у
 * панелі й на екрані входу.
 */
function useMenuPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement>,
  align: 'left' | 'right',
  direction: 'down' | 'up',
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const r = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Бажаний напрям виконуємо, поки він поміщається; інакше беремо той бік,
    // де місця більше. Точна висота тут не потрібна — лише вибір боку.
    const roomBelow = vh - r.bottom - GAP - VIEWPORT_PAD;
    const roomAbove = r.top - GAP - VIEWPORT_PAD;
    const up =
      direction === 'up'
        ? roomAbove >= MENU_HEIGHT || roomAbove >= roomBelow
        : roomBelow < MENU_HEIGHT && roomAbove > roomBelow;

    // Притискаємо до вікна: у вузькій рейці меню ширше за саму кнопку.
    const rawLeft = align === 'left' ? r.left : r.right - MENU_WIDTH;
    const left = Math.min(
      Math.max(rawLeft, VIEWPORT_PAD),
      Math.max(VIEWPORT_PAD, vw - MENU_WIDTH - VIEWPORT_PAD),
    );

    setStyle(
      up
        ? { position: 'fixed', left, bottom: vh - r.top + GAP, width: MENU_WIDTH }
        : { position: 'fixed', left, top: r.bottom + GAP, width: MENU_WIDTH },
    );
  }, [anchorRef, align, direction]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    place();
    // Прокрутка будь-якого предка (capture) і зміна розміру рухають кнопку —
    // меню має їхати за нею, а не лишатись висіти посеред екрана.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return style;
}

export default function LanguageSwitcher({
  variant = 'compact',
  align = 'right',
  direction = 'down',
  className = '',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Портал вимагає document — на сервері його немає.
  useEffect(() => setMounted(true), []);

  const menuStyle = useMenuPosition(open, buttonRef, align, direction);

  // Клік поза меню і Escape закривають список
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Меню живе в порталі, тож rootRef його НЕ містить: без окремої
      // перевірки mousedown закривав би список раніше, ніж спрацює click,
      // і мова ніколи б не перемикалась.
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next !== locale) setLocale(next);
  };

  /*
    ── сітка мов ──
    Десять кодів у один ряд не поміщаються навіть на розгорнутій бічній
    панелі, тому це сітка 5×2, а не смуга. Прапорець тут несе основне
    навантаження, код лишається підписом під ним.
  */
  if (variant === 'segmented') {
    return (
      <div
        className={`grid grid-cols-5 gap-1 ${className}`}
        role="group"
        aria-label={t('nav.interfaceLanguage')}
        data-tour="language"
      >
        {LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              onClick={() => choose(code)}
              title={meta.native}
              aria-label={meta.native}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-control py-1.5 transition-colors ${
                active
                  ? 'bg-accent-soft text-txt-primary'
                  : 'text-txt-muted hover:bg-surface-hover hover:text-txt-primary'
              }`}
            >
              <Flag region={meta.region} size={20} />
              <span className="font-mono text-micro font-semibold tracking-wider">
                {meta.short}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── компактна кнопка з випадним списком ── */
  const activeMeta = LOCALE_META[locale];

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('nav.interfaceLanguage')}
      /* Вище мобільної шухляди (z-50) і шарів Leaflet (400), нижче
         навчального оверлея (900). */
      className="glass-float animate-pop z-[600] overflow-y-auto rounded-card p-1.5"
      style={{ ...(menuStyle ?? {}), maxHeight: 'min(70vh, 420px)' }}
    >
      <p className="micro-label px-2.5 pb-1.5 pt-1">{t('nav.interfaceLanguage')}</p>

      {LOCALES.map((code) => {
        const meta = LOCALE_META[code];
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => choose(code)}
            className={`flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors ${
              active
                ? 'bg-accent-soft text-txt-primary'
                : 'text-txt-secondary hover:bg-surface-hover hover:text-txt-primary'
            }`}
          >
            <Flag region={meta.region} size={22} />
            <span
              aria-hidden
              className={`shrink-0 font-mono text-micro font-semibold tracking-wider ${
                active ? 'text-accent' : 'text-txt-muted'
              }`}
            >
              {meta.short}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-2xs font-medium">{meta.native}</span>
              <span className="block font-mono text-micro text-txt-muted">{meta.intl}</span>
            </span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`} data-tour="language">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.interfaceLanguage')}
        title={t('nav.interfaceLanguage')}
        className="btn btn-ghost h-9 gap-1.5 px-2.5"
      >
        <Flag region={activeMeta.region} size={18} />
        <span className="font-mono text-micro font-semibold tracking-wider">
          {activeMeta.short}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-txt-muted transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Малюємо лише коли позицію вже пораховано, інакше перший кадр
          з'явився б у лівому верхньому куті екрана. */}
      {open && mounted && menuStyle && createPortal(menu, document.body)}
    </div>
  );
}
