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
import { t } from '@/lib/i18n';

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
    title: 'tour.welcomeVELESERP',
    body: 'tour.shortTourMenu30',
    target: '[data-tour="brand"]',
  },
  {
    id: 'overview',
    title: 'common.dashboard',
    body: 'tour.fuelSummarySpendingVolumes',
    target: '[data-tour="nav-overview"]',
  },
  {
    id: 'cards',
    title: 'common.fuelCards',
    body: 'tour.everyOKKOShellCard',
    target: '[data-tour="nav-cards"]',
  },
  {
    id: 'transactions',
    title: 'common.transactionLog',
    body: 'tour.everyRefuellingStationCard',
    target: '[data-tour="nav-transactions"]',
  },
  {
    id: 'analytics',
    title: 'common.fuelAnalytics',
    body: 'tour.spendingTrendChartsBrand',
    target: '[data-tour="nav-analytics"]',
  },
  {
    id: 'merchants',
    title: 'common.stationNetwork',
    body: 'tour.mapDirectoryStationsYour',
    target: '[data-tour="nav-merchants"]',
  },
  {
    id: 'ruptela',
    title: 'tour.ruptelaFMSTelematics',
    body: 'tour.liveTrackerSectionPosition',
    target: '[data-tour="nav-ruptela"]',
  },
  {
    id: 'ruptela-fleet',
    title: 'common.myFleet',
    body: 'tour.mapWholeFleetLatest',
    target: '[data-tour="nav-ruptela-fleet"]',
  },
  {
    id: 'live',
    title: 'common.realTime',
    body: 'tour.watchingSingleVehicleTrack',
    target: '[data-tour="nav-live"]',
  },
  {
    id: 'create-trip',
    title: 'common.createATrip',
    body: 'tour.routeStopsTasksSaved',
    target: '[data-tour="nav-create-trip"]',
    staffOnly: true,
  },
  {
    id: 'guest-limits',
    title: 'tour.guestMode',
    body: 'tour.youSignedGuestAll',
    target: '[data-tour="role"]',
    guestOnly: true,
  },
  {
    id: 'routes',
    title: 'common.routesAndTasks',
    body: 'tour.activeArchivedTripsWaypoints',
    target: '[data-tour="nav-routes"]',
  },
  {
    id: 'theme',
    title: 'tour.theme',
    body: 'tour.lightDarkThemesSwitch',
    target: '[data-tour="theme"]',
  },
  {
    id: 'restart',
    title: 'tour.trainingAlwaysHand',
    body: 'tour.trainingButtonStaysLeft',
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
    throw new Error(t('tour.usetourMustCalledInside'));
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
