'use client';

/*
 * `group` — це не підпис, а дискримінатор типу Group: за ним групуються й
 * шукаються команди. Переклад ставиться в місці рендеру — {t(section.group)}.
 * i18n-ignore-props: group, Group
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  CreditCard,
  Fuel,
  GraduationCap,
  History,
  Link2,
  LogOut,
  Radio,
  MapPin,
  Monitor,
  Moon,
  PlusCircle,
  RefreshCw,
  Route,
  Search,
  Sun,
  Terminal,
  Truck,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useTour } from '@/context/TourContext';
import { signOut, useSessionUser } from '@/lib/useAuthGuard';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/** Dispatch on `window` to open the palette from anywhere. */
export const COMMAND_PALETTE_EVENT = 'veles:command-palette';
/** Pages that expose a refresh handler listen for this. */
export const REFRESH_EVENT = 'veles:refresh';

const RECENT_KEY = 'veles_palette_recent';
const RECENT_MAX = 4;

type Group = 'nav.recent' | 'nav.navigation' | 'common.actions' | 'nav.appearance';

interface Command {
  id: string;
  label: string;
  group: Exclude<Group, 'nav.recent'>;
  icon: React.ElementType;
  /** Extra match text — latin aliases, synonyms. Never rendered. */
  keywords?: string;
  /** Right-aligned context, e.g. the route it navigates to. */
  hint?: string;
  run: () => void;
}

/**
 * Subsequence match with positional scoring. Rewards consecutive hits and
 * word-start hits so "жтр" ranks "Журнал транзакцій" above an incidental match.
 * Returns -1 when the query is not a subsequence at all.
 */
function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  let score = 0;
  let cursor = 0;
  let streak = 0;

  for (let i = 0; i < q.length; i++) {
    const found = t.indexOf(q[i], cursor);
    if (found === -1) return -1;

    score += 10;
    if (found === cursor && i > 0) {
      streak += 1;
      score += 8 + streak * 2;
    } else {
      streak = 0;
    }
    if (found === 0 || /[\s\-/·(,]/.test(t[found - 1] ?? '')) score += 12;
    score -= Math.min(found - cursor, 8);
    cursor = found + 1;
  }

  if (t.includes(q)) score += 30;
  if (t.startsWith(q)) score += 20;
  return score;
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Global ⌘K / Ctrl+K command palette: navigation, session and appearance actions.
 *
 * Layering: the scrim is a flat tint and the panel carries the only
 * backdrop-filter in the stack — stacking two blurs turns the page to soup.
 * Rows inside use opaque surfaces for the same reason.
 */
export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { setPreference } = useTheme();
  const { startTour } = useTour();
  const { isGuest } = useSessionUser();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);

    return [
      { id: 'nav-overview', label: t('common.dashboard'), group: 'nav.navigation', icon: Fuel, hint: '/', keywords: 'dashboard golovna zvedennia', run: go('/') },
      { id: 'nav-cards', label: t('common.fuelCards'), group: 'nav.navigation', icon: CreditCard, hint: '/cards', keywords: 'cards kartky palyvni', run: go('/cards') },
      { id: 'nav-tx', label: t('common.transactionLog'), group: 'nav.navigation', icon: History, hint: '/transactions', keywords: 'transactions zhurnal operacii cheky', run: go('/transactions') },
      { id: 'nav-analytics', label: t('common.fuelAnalytics'), group: 'nav.navigation', icon: BarChart3, hint: '/analytics', keywords: 'analytics grafiky zvity statystyka', run: go('/analytics') },
      { id: 'nav-merchants', label: t('common.stationNetwork'), group: 'nav.navigation', icon: MapPin, hint: '/merchants', keywords: 'merchants azs stancii mapa', run: go('/merchants') },
      { id: 'nav-fleet3d', label: t('nav.n3dMonitoring'), group: 'nav.navigation', icon: Boxes, hint: '/fleet', keywords: 'fleet 3d diagnostyka truck', run: go('/fleet') },
      { id: 'nav-ruptela-fleet', label: t('nav.myFleetTelematics'), group: 'nav.navigation', icon: Truck, hint: '/ruptela/fleet', keywords: 'ruptela avtopark telematyka gps', run: go('/ruptela/fleet') },
      { id: 'nav-live', label: t('nav.realTimeWatchingVehicle'), group: 'nav.navigation', icon: Radio, hint: '/ruptela/live', keywords: 'live realnyi chas track monitoring gps', run: go('/ruptela/live') },
      // Creating a trip writes to Ruptela — a guest would be rejected by the server.
      ...(isGuest
        ? []
        : [{ id: 'nav-trip-new', label: t('common.createATrip'), group: 'nav.navigation' as const, icon: PlusCircle, hint: '/ruptela/create-trip', keywords: 'trip poizdka nova reis', run: go('/ruptela/create-trip') }]),
      { id: 'nav-routes', label: t('common.routesAndTasks'), group: 'nav.navigation', icon: Route, hint: '/ruptela/routes-tasks', keywords: 'routes marshrut zavdannia', run: go('/ruptela/routes-tasks') },
      { id: 'nav-api', label: t('nav.apiConsole'), group: 'nav.navigation', icon: Terminal, hint: '/api-console', keywords: 'api konsol debug zapyty', run: go('/api-console') },
      { id: 'nav-uikit', label: t('nav.uiKitComponentLibrary'), group: 'nav.navigation', icon: Boxes, hint: '/ui-kit', keywords: 'ui kit komponenty design system', run: go('/ui-kit') },

      {
        id: 'act-refresh',
        label: t('nav.refreshPageData'),
        group: 'common.actions',
        icon: RefreshCw,
        keywords: 'refresh onovyty perezavantazhyty',
        hint: 'R',
        run: () => window.dispatchEvent(new CustomEvent(REFRESH_EVENT)),
      },
      {
        id: 'act-copy-link',
        label: t('nav.copyPageLink'),
        group: 'common.actions',
        icon: Link2,
        keywords: 'copy link posylannia url',
        run: () => {
          navigator.clipboard?.writeText(window.location.href).catch(() => {});
        },
      },
      {
        id: 'act-tour',
        label: t('nav.trainingTourInterface'),
        group: 'common.actions',
        icon: GraduationCap,
        keywords: 'tour navchannia onboarding pidkazky help dopomoga',
        run: startTour,
      },
      {
        id: 'act-signout',
        label: t('common.signOut'),
        group: 'common.actions',
        icon: LogOut,
        keywords: 'logout vyity exit session',
        run: () => {
          signOut();
          router.replace('/');
        },
      },

      // Три режими — три окремі команди: у палітрі шукають конкретний режим
      // («темна»), а не «наступний у циклі».
      {
        id: 'view-theme-light',
        label: t('common.switchLightTheme'),
        group: 'nav.appearance',
        icon: Sun,
        keywords: 'theme tema svitla light',
        run: () => setPreference('light'),
      },
      {
        id: 'view-theme-dark',
        label: t('common.switchDarkTheme'),
        group: 'nav.appearance',
        icon: Moon,
        keywords: 'theme tema temna dark',
        run: () => setPreference('dark'),
      },
      {
        id: 'view-theme-system',
        label: t('common.switchSystemTheme'),
        group: 'nav.appearance',
        icon: Monitor,
        keywords: 'theme tema systemna system auto',
        run: () => setPreference('system'),
      },
    ];
  }, [router, setPreference, isGuest, startTour]);

  /** Groups in display order, filtered and ranked against the query. */
  const sections = useMemo(() => {
    const q = query.trim();

    if (!q) {
      const byId = new Map(commands.map((c) => [c.id, c]));
      const recentCmds = recent
        .map((id) => byId.get(id))
        .filter((c): c is Command => Boolean(c));

      const rest = commands.filter((c) => !recent.includes(c.id));
      const order: Group[] = ['nav.recent', 'nav.navigation', 'common.actions', 'nav.appearance'];

      return order
        .map((group) => ({
          group,
          items:
            group === 'nav.recent'
              ? recentCmds
              : rest.filter((c) => c.group === group),
        }))
        .filter((s) => s.items.length > 0);
    }

    const scored = commands
      .map((c) => ({ c, score: Math.max(fuzzyScore(c.label, q), fuzzyScore(c.keywords ?? '', q) - 6) }))
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    const order: Group[] = ['nav.navigation', 'common.actions', 'nav.appearance'];
    return order
      .map((group) => ({ group, items: scored.filter((s) => s.c.group === group).map((s) => s.c) }))
      .filter((s) => s.items.length > 0);
  }, [commands, query, recent]);

  /** Flat list backing arrow-key navigation across group boundaries. */
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  /** Row → flat index, so rendering never has to mutate a counter mid-pass. */
  const indexOfRow = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((cmd, i) => map.set(cmd.id, i));
    return map;
  }, [flat]);

  useEffect(() => setActive(0), [query, open]);

  const runCommand = useCallback(
    (cmd: Command) => {
      setOpen(false);
      setQuery('');
      const next = [cmd.id, ...readRecent().filter((id) => id !== cmd.id)].slice(0, RECENT_MAX);
      setRecent(next);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* private mode — recents are a nicety, not a requirement */
      }
      cmd.run();
    },
    [],
  );

  // ⌘K / Ctrl+K anywhere, plus an app-wide custom event for trigger buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Автозаповнення менеджера паролів шле keydown без `key` — без цієї
      // перевірки обробник падає на кожному вході в систему.
      if (e.key?.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onEvent);
    };
  }, []);

  // Close on route change — a navigation command has done its job.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  // Scroll lock + focus handoff
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, flat.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[active];
      if (cmd) runCommand(cmd);
      return;
    }
    // Only the input is focusable inside the dialog, so Tab must not escape it.
    if (e.key === 'Tab') e.preventDefault();
  };

  if (!mounted || !open || pathname === '/login') return null;

  return createPortal(
    <div
      className="cmd-overlay flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('common.commandPalette')}
        onKeyDown={onDialogKeyDown}
        className="cmd-panel w-full max-w-[560px] overflow-hidden"
      >
        {/* Search row */}
        <div className="flex items-center gap-3 border-b border-bdr-subtle px-4">
          <Search className="h-4 w-4 shrink-0 text-txt-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.whereTryLogThemeEllipsis')}
            aria-label={t('nav.searchCommands')}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-listbox"
            aria-activedescendant={flat[active] ? `cmd-opt-${flat[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full bg-transparent text-sm text-txt-primary outline-none placeholder:text-txt-muted"
          />
          <button type="button" onClick={close} className="kbd shrink-0" title={t('nav.closeEsc')}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="cmd-listbox"
          role="listbox"
          aria-label={t('nav.availableCommands')}
          className="max-h-[52vh] overflow-y-auto overscroll-contain p-2"
        >
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Search className="h-5 w-5 text-txt-muted" aria-hidden="true" />
              <p className="text-xs text-txt-secondary">
                {t('nav.nothingFoundFor')}{query}»
              </p>
              <p className="text-2xs text-txt-muted">
                {t('nav.trySectionNameCards')}
              </p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.group} className="mb-1 last:mb-0">
                <p className="micro-label px-3 pb-1 pt-2">{t(section.group)}</p>
                {section.items.map((cmd) => {
                  const i = indexOfRow.get(cmd.id) ?? 0;
                  const isActive = i === active;
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      id={`cmd-opt-${cmd.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runCommand(cmd)}
                      className={cn('cmd-item cursor-pointer', isActive && 'cmd-item-active')}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && (
                        <span className="shrink-0 font-mono text-[10px] text-txt-muted">
                          {cmd.hint}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer legend */}
        <div className="flex items-center gap-4 border-t border-bdr-subtle px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[10px] text-txt-muted">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            {t('nav.navigationWord')}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-txt-muted">
            <span className="kbd">⏎</span>
            {t('nav.run')}
          </span>
          <span className="ml-auto text-[10px] text-txt-muted">VELES ERP</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Sidebar/header affordance that opens the palette — discoverability for ⌘K. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))}
      aria-label={t('nav.openCommandPalette')}
      title={t('common.commandPalette')}
      className={cn(
        'group flex h-9 items-center gap-2 rounded-field border border-bdr-subtle bg-surface px-3 text-xs text-txt-muted transition-colors hover:border-bdr-strong hover:bg-surface-hover hover:text-txt-primary',
        className,
      )}
    >
      <Search className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{t('common.searchEllipsis')}</span>
      <span className="kbd ml-2 hidden sm:inline-flex" aria-hidden="true">
        {isMac ? '⌘' : 'Ctrl'} K
      </span>
    </button>
  );
}
