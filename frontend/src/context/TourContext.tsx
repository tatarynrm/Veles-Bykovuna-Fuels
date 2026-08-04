'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { isGuestUser, readSessionUser } from '@/lib/useAuthGuard';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /**
   * CSS selector of the element to spotlight. The sidebar renders twice (desktop
   * rail + mobile drawer), so the overlay picks the first *visible* match; when
   * nothing is visible the step still shows, just centred without a spotlight.
   */
  target?: string;
  /** Shown only in a guest session. */
  guestOnly?: boolean;
  /** Hidden in a guest session (the feature is blocked for them). */
  staffOnly?: boolean;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Вітаємо у VELES ERP',
    body: 'Коротка екскурсія меню: 30 секунд, і ви знатимете, де що лежить. Ліворуч — навігація, вона однакова на всіх сторінках.',
    target: '[data-tour="brand"]',
  },
  {
    id: 'overview',
    title: 'Панель керування',
    body: 'Зведення по паливу: витрати, обсяги та ключові показники за обраний період і бренд (ОККО, Shell або разом).',
    target: '[data-tour="nav-overview"]',
  },
  {
    id: 'cards',
    title: 'Паливні картки',
    body: 'Усі картки ОККО та Shell в одному списку: статус, ліміти, привʼязка до транспорту.',
    target: '[data-tour="nav-cards"]',
  },
  {
    id: 'transactions',
    title: 'Журнал транзакцій',
    body: 'Кожна заправка: АЗК, картка, обсяг, сума. Фільтри за датою й брендом, експорт в Excel і PDF.',
    target: '[data-tour="nav-transactions"]',
  },
  {
    id: 'analytics',
    title: 'Аналітика палива',
    body: 'Графіки динаміки витрат, порівняння брендів і топ АЗК. Тут видно тенденції, яких не помітно в журналі.',
    target: '[data-tour="nav-analytics"]',
  },
  {
    id: 'merchants',
    title: 'Мережа АЗК',
    body: 'Карта та довідник заправок, доступних за вашими картками.',
    target: '[data-tour="nav-merchants"]',
  },
  {
    id: 'ruptela',
    title: 'Ruptela FMS — телематика',
    body: 'Розділ живих даних з трекерів: місце, пальне, CAN-показники, поїздки. Виділений бурштиновим кольором, щоб не плутати з паливними картками.',
    target: '[data-tour="nav-ruptela"]',
  },
  {
    id: 'ruptela-fleet',
    title: 'Мій автопарк',
    body: 'Карта всього автопарку з останніми GPS-фіксами та телеметрією обраного тягача.',
    target: '[data-tour="nav-ruptela-fleet"]',
  },
  {
    id: 'live',
    title: 'Реальний час',
    body: 'Спостереження за одним автомобілем: трек оновлюється кожні 5 секунд, поруч — швидкість, пальне, оберти й журнал записів пристрою.',
    target: '[data-tour="nav-live"]',
  },
  {
    id: 'create-trip',
    title: 'Створити поїздку',
    body: 'Маршрут із точками й завданнями, який зберігається напряму в Ruptela і може бути надісланий водієві.',
    target: '[data-tour="nav-create-trip"]',
    staffOnly: true,
  },
  {
    id: 'guest-limits',
    title: 'Гостьовий режим',
    body: 'Ви увійшли як гість: усі дані доступні для перегляду, але створення та редагування маршрутів вимкнено — щоб випадково не надіслати завдання реальному водієві.',
    target: '[data-tour="role"]',
    guestOnly: true,
  },
  {
    id: 'routes',
    title: 'Маршрут і завдання',
    body: 'Активні та архівні поїздки, точки маршруту, статуси й чек-листи завдань.',
    target: '[data-tour="nav-routes"]',
  },
  {
    id: 'theme',
    title: 'Тема оформлення',
    body: 'Світла й темна теми перемикаються тут або клавішами ⌘K → «Тема». Вибір зберігається між сеансами.',
    target: '[data-tour="theme"]',
  },
  {
    id: 'restart',
    title: 'Навчання завжди поруч',
    body: 'Кнопка «Навчання» залишається в лівому меню — натисніть будь-коли, щоб пройти екскурсію ще раз.',
    target: '[data-tour="tour-button"]',
  },
];

/** Bump the suffix to re-prompt everyone after the tour content changes. */
const TOUR_STATE_KEY = 'veles_tour_v1';
type StoredState = 'done' | 'declined';

interface TourContextValue {
  /** Steps for the current session (guest-specific ones filtered in/out). */
  steps: TourStep[];
  stepIndex: number;
  isRunning: boolean;
  isPrompting: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  acceptPrompt: () => void;
  declinePrompt: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour має викликатись усередині <TourProvider>');
  }
  return ctx;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isGuest, setIsGuest] = useState(false);
  const [status, setStatus] = useState<'idle' | 'prompt' | 'running'>('idle');
  const [stepIndex, setStepIndex] = useState(0);

  const onLogin = pathname === '/login';

  const steps = useMemo(
    () => STEPS.filter((s) => (s.guestOnly ? isGuest : s.staffOnly ? !isGuest : true)),
    [isGuest],
  );

  /* Offer the tour once per browser, and only to someone actually logged in. */
  useEffect(() => {
    if (onLogin || typeof window === 'undefined') return;

    setIsGuest(isGuestUser(readSessionUser()));

    if (!window.localStorage.getItem('veles_token')) return;
    if (window.localStorage.getItem(TOUR_STATE_KEY)) return;

    // Let the page paint first — a dialog over a skeleton reads as an error.
    const timer = setTimeout(() => setStatus('prompt'), 700);
    return () => clearTimeout(timer);
  }, [onLogin, pathname]);

  const remember = (state: StoredState) => {
    try {
      window.localStorage.setItem(TOUR_STATE_KEY, state);
    } catch {
      /* private mode — the tour simply offers itself again next time */
    }
  };

  const startTour = useCallback(() => {
    setIsGuest(isGuestUser(readSessionUser()));
    setStepIndex(0);
    setStatus('running');
  }, []);

  const endTour = useCallback(() => {
    setStatus('idle');
    setStepIndex(0);
    remember('done');
  }, []);

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        setStatus('idle');
        remember('done');
        return 0;
      }
      return i + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const acceptPrompt = useCallback(() => startTour(), [startTour]);

  const declinePrompt = useCallback(() => {
    setStatus('idle');
    remember('declined');
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      steps,
      stepIndex,
      isRunning: status === 'running',
      isPrompting: status === 'prompt',
      startTour,
      nextStep,
      prevStep,
      endTour,
      acceptPrompt,
      declinePrompt,
    }),
    [
      steps,
      stepIndex,
      status,
      startTour,
      nextStep,
      prevStep,
      endTour,
      acceptPrompt,
      declinePrompt,
    ],
  );

  // The overlay is mounted by the layout, not here — keeping it out avoids an
  // import cycle between the provider and the component that consumes it.
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
