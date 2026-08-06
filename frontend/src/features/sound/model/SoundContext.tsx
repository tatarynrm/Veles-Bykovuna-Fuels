'use client';

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { SoundEngine, type SoundName } from './engine';

const STORAGE_KEY = 'veles_sound_v1';

interface SoundPrefs {
  enabled: boolean;
  volume: number;
}

/**
 * За замовчуванням звук увімкнений, але тихий. Реально він однаково не
 * зазвучить до першого кліку — браузер тримає AudioContext у suspended, —
 * тож «увімкнено» тут означає «дозволено, щойно користувач торкнеться
 * сторінки», а не «грає з першого кадру».
 */
const DEFAULTS: SoundPrefs = { enabled: true, volume: 0.45 };

interface SoundContextValue extends SoundPrefs {
  /** Контекст запущено і звук справді чутно. */
  unlocked: boolean;
  /** Увімкнено в налаштуваннях, але браузер ще чекає на жест. */
  awaitingGesture: boolean;
  setEnabled: (value: boolean) => void;
  setVolume: (value: number) => void;
  play: (name: SoundName) => void;
  resetSequence: () => void;
}

const SoundCtx = createContext<SoundContextValue | null>(null);

function readPrefs(): SoundPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  // Той, хто просив менше руху, майже напевно не хоче й фонового гулу.
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SoundPrefs>;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : !calm,
        volume:
          typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
            ? parsed.volume
            : DEFAULTS.volume,
      };
    }
  } catch {
    /* приватний режим — лишаємо типові */
  }
  return { enabled: !calm, volume: DEFAULTS.volume };
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<SoundEngine | null>(null);
  const [prefs, setPrefs] = useState<SoundPrefs>(DEFAULTS);
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Колбеки не мають перестворюватись на кожну зміну гучності — їх тримають
  // обробники scroll та IntersectionObserver, — тому актуальні налаштування
  // читаються через ref, а не через замикання.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  if (engineRef.current === null && typeof window !== 'undefined') {
    engineRef.current = new SoundEngine();
  }

  // Налаштування читаємо після монтування: SSR і перший клієнтський кадр
  // мусять збігатися, інакше React свариться на розбіжність.
  useEffect(() => {
    const saved = readPrefs();
    setPrefs(saved);
    setHydrated(true);
    const engine = engineRef.current;
    if (engine) {
      engine.setVolume(saved.volume);
      engine.setMuted(!saved.enabled);
    }
  }, []);

  // Розблокування звуку першим же жестом.
  useEffect(() => {
    if (!hydrated || !prefs.enabled || unlocked) return;
    const engine = engineRef.current;
    if (!engine) return;

    let cancelled = false;
    const events = ['pointerdown', 'keydown', 'touchend'] as const;

    const attempt = async () => {
      const ok = await engine.unlock();
      if (cancelled || !ok) return;
      setUnlocked(true);
      engine.startEngine();
      events.forEach(e => window.removeEventListener(e, attempt));
    };

    // Спроба одразу: якщо користувач уже клікав на сторінці (перехід між
    // маршрутами), контекст може бути дозволений і чекати нема на що.
    void attempt();
    events.forEach(e => window.addEventListener(e, attempt, { passive: true }));

    return () => {
      cancelled = true;
      events.forEach(e => window.removeEventListener(e, attempt));
    };
  }, [hydrated, prefs.enabled, unlocked]);

  // Фоновий гул у прихованій вкладці — це те, через що звук на сайтах
  // вимикають назавжди.
  useEffect(() => {
    const onVisibility = () => {
      const engine = engineRef.current;
      if (!engine || !unlocked) return;
      if (document.hidden) engine.stopEngine();
      else if (prefs.enabled) engine.startEngine();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [unlocked, prefs.enabled]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const persist = useCallback((next: SoundPrefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* вибір діятиме до перезавантаження */
    }
  }, []);

  const setEnabled = useCallback(
    (value: boolean) => {
      const engine = engineRef.current;
      persist({ ...prefsRef.current, enabled: value });
      if (!engine) return;
      engine.setMuted(!value);
      if (value) {
        void engine.unlock().then(ok => {
          if (!ok) return;
          setUnlocked(true);
          engine.startEngine();
        });
      } else {
        engine.stopEngine();
      }
    },
    [persist],
  );

  const setVolume = useCallback(
    (value: number) => {
      persist({ ...prefsRef.current, volume: value });
      engineRef.current?.setVolume(value);
    },
    [persist],
  );

  const play = useCallback((name: SoundName) => {
    engineRef.current?.play(name);
  }, []);

  const resetSequence = useCallback(() => {
    engineRef.current?.resetSequence();
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      ...prefs,
      unlocked,
      awaitingGesture: prefs.enabled && !unlocked && hydrated,
      setEnabled,
      setVolume,
      play,
      resetSequence,
    }),
    [prefs, unlocked, hydrated, setEnabled, setVolume, play, resetSequence],
  );

  return <SoundCtx.Provider value={value}>{children}</SoundCtx.Provider>;
}

/**
 * Поза провайдером повертає no-op замість помилки: маркетингові компоненти
 * час від часу перевикористовуються всередині застосунку, де звуку немає.
 */
export function useSound(): SoundContextValue {
  const ctx = useContext(SoundCtx);
  return (
    ctx ?? {
      enabled: false,
      volume: 0,
      unlocked: false,
      awaitingGesture: false,
      setEnabled: () => {},
      setVolume: () => {},
      play: () => {},
      resetSequence: () => {},
    }
  );
}
