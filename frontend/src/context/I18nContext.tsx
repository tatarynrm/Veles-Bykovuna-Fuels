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
  getLocale,
  isLocale,
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  readLocaleCookie,
  writeLocaleCookie,
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

export function I18nProvider({
  children,
  /**
   * Мова з cookie, прочитана в layout на сервері. Саме завдяки їй SSR-розмітка
   * приходить уже потрібною мовою — без цього кожне завантаження показувало
   * кадр українською, а потім усе дерево перемонтовувалось.
   */
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [ready, setReady] = useState(false);

  /*
    Синхронно, ще до рендеру дітей: t() читає мову з модуля, а не з контексту,
    тож на першому ж проході — і на сервері, і на клієнті — вона має бути
    правильною. Інакше діти встигнуть намалюватись мовою за замовчуванням.

    Звіряємось саме зі СТАНОМ, а не з initialLocale. Раніше тут стояв
    initialLocale — і мова не перемикалась без перезавантаження: цей проп
    приходить із cookie на момент серверного рендера й після вибору мови
    лишається старим. setLocale записував cookie, застосовував нову мову й
    оновлював стан, після чого провайдер перерендерювався, бачив
    `getLocale() !== initialLocale` і відкочував мову назад. Помагав лише
    перезавантаження, бо тоді сервер віддавав уже нову cookie.

    На першому рендері locale === initialLocale, тож для SSR поведінка та сама.

    На сервері це загальнопроцесна змінна. Для внутрішнього ERP із кількома
    диспетчерами цього досить, але якщо застосунок колись обслуговуватиме
    багатьох користувачів з різними мовами одночасно — цю змінну доведеться
    зробити запитоскопною (AsyncLocalStorage).
  */
  if (getLocale() !== locale) applyLocale(locale);

  useIsomorphicLayoutEffect(() => {
    /*
      Пріоритет: вибір користувача (cookie) → застарілий localStorage →
      мова браузера → англійська.

      Коли cookie вже є, initialLocale із сервера з нею збігається, стан не
      змінюється — і дерево не перемонтовується. Тіло ефекту працює лише на
      першому візиті або після міграції зі старого localStorage.
    */
    let initial: Locale | null = readLocaleCookie();

    if (!initial) {
      try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
        if (isLocale(saved)) initial = saved;
      } catch {
        /* приватний режим — лишається автовизначення */
      }
      // Мова браузера нічого не зберігає: якщо користувач змінить мову системи,
      // він отримає нову, а не назавжди «залиплу» першу.
      if (initial) writeLocaleCookie(initial);
    }

    const resolved = initial ?? detectLocale();
    if (resolved !== locale) {
      applyLocale(resolved);
      setLocaleState(resolved);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    // Cookie — головне сховище: саме її читає сервер. localStorage лишається
    // дублем для інлайн-скрипта в layout, який виставляє <html lang> ще до React.
    writeLocaleCookie(next);
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
