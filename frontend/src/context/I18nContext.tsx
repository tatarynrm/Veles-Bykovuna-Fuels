'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  applyLocale,
  detectLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  t,
  type Locale,
} from '@/lib/i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Той самий t, що й у lib/i18n — тут лише для зручності в компонентах. */
  t: typeof t;
  /** false до першого клієнтського ефекту: мова ще може смикнутись. */
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * На сервері useLayoutEffect попереджає в консоль, але саме він потрібен на
 * клієнті: мову треба застосувати ДО першого малювання, інакше користувач
 * побачить кадр українською.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    /*
      Пріоритет: вибір користувача → мова браузера → англійська.
      Вибір зберігається лише тоді, коли його зробили свідомо (setLocale), —
      автовизначення нічого не пише, тож користувач, який змінив мову системи,
      отримає нову мову, а не назавжди «залиплу» першу.
    */
    let initial: Locale = detectLocale();
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) initial = saved;
    } catch {
      /* приватний режим — лишається автовизначення */
    }
    applyLocale(initial);
    setLocaleState(initial);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* без збереження — мова діятиме до перезавантаження */
    }
    applyLocale(next);
    setLocaleState(next);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, ready }}>
      {/*
        t() читає мову з модуля, а не з контексту, — тож перемальовувати треба
        все піддерево. Ключ робить це одним рухом і покриває навіть ті місця,
        які не підписані на контекст (утиліти, графіки, сторонні обгортки).
        Зміна мови — рідка дія, тому втрата локального стану сторінки прийнятна.
      */}
      <React.Fragment key={locale}>{children}</React.Fragment>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
