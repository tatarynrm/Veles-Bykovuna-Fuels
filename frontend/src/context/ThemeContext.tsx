'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

/** Що обрав користувач. `system` — слідувати за налаштуванням ОС. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** Що зрештою намальовано. Саме це потрібно картам і графікам. */
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  /** Обрана тема — те, що підсвічується в перемикачі. */
  preference: ThemePreference;
  /** Застосована тема. `system` тут уже розкрито у light/dark. */
  theme: ResolvedTheme;
  /** false до першого клієнтського ефекту. */
  mounted: boolean;
  setPreference: (next: ThemePreference) => void;
  /** Явно перемикає світлу ↔ темну (виходить із режиму «системна»). */
  toggleTheme: () => void;
  /** Сумісність зі старими викликами: setTheme('light'|'dark'|'system'). */
  setTheme: (next: ThemePreference) => void;
}

const STORAGE_KEY = 'veles_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const systemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? systemTheme() : preference;

/**
 * Малює тему. Ті самі три дії робить інлайн-скрипт у layout.tsx до першого
 * кадру — тому обидва місця треба міняти разом.
 */
function paint(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('light-theme', theme === 'light');
  document.body.classList.toggle('light-theme', theme === 'light');
  root.dataset.theme = theme;
}

/**
 * На сервері useLayoutEffect попереджає в консоль, але саме він потрібен на
 * клієнті: стан треба синхронізувати ДО малювання, інакше компоненти, які
 * читають `theme` (карти, графіки, іконка перемикача), встигають блимнути
 * не тією темою.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Значення за замовчуванням — «системна»: до першого ефекту SSR і клієнт
  // мають збігатися, тому тут не можна читати localStorage.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [theme, setThemeState] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useIsomorphicLayoutEffect(() => {
    let initial: ThemePreference = 'system';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isPreference(saved)) initial = saved;
      else if (saved) {
        // Ключ колись зберігав лише light/dark — прибираємо сміття
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* приватний режим — лишаємо системну */
    }

    setPreferenceState(initial);
    const resolved = resolve(initial);
    setThemeState(resolved);
    paint(resolved);
    setMounted(true);
  }, []);

  // Стеження за темою ОС має сенс лише поки обрано «системна»
  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const resolved = systemTheme();
      setThemeState(resolved);
      paint(resolved);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* без збереження — вибір діятиме до перезавантаження */
    }
    const resolved = resolve(next);
    setThemeState(resolved);
    paint(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolve(preference) === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        theme,
        mounted,
        setPreference,
        setTheme: setPreference,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
