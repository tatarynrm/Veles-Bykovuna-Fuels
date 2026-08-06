import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Unbounded, Manrope } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/context/I18nContext';
import { TourProvider } from '@/context/TourContext';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, t } from '@/lib/i18n';
import CommandPalette from '@/components/ui/CommandPalette';
import OnboardingTour from '@/components/OnboardingTour';
import SplashScreen from '@/components/SplashScreen';

/**
 * Метадані рендеряться на сервері під час збірки, коли мови користувача ще
 * немає, — тому тут завжди українська (t() без обраної мови повертає uk).
 * Перекласти опис під кожну мову можна лише окремими маршрутами /en, /pl,
 * від яких ця збірка навмисно відмовилась.
 */
/*
  Дві гарнітури, обидві з кирилицею — це головний критерій: більшість «сучасних»
  гротесків (Space Grotesk, Geist, Outfit) кирилиці не мають узагалі, і
  український заголовок мовчки падав би на системний фallback.

  cyrillic-ext обов'язковий: ґ (U+0491) та частина української діакритики лежать
  саме там, а не в базовому cyrillic.

  Manrope — гарнітура інтерфейсу, замість Inter: тепліша, з характером, але так
  само спокійна у щільних таблицях.
  Unbounded — акцидентна, лише для заголовків маркетингових сторінок. Вона
  широка, тож у застосунку її немає: дашборд лишається на Manrope.
*/
const fontBody = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-body',
  display: 'swap',
});

const fontDisplay = Unbounded({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VELES ERP | VELES BUKOVYNA FUELS',
  description: t('common.fuelAccountingAnalyticsPlatform'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070A10' },
    { media: '(prefers-color-scheme: light)', color: '#F4F6FA' },
  ],
};

/**
 * Малює тему до першого кадру, щоб сторінка не блимала чужою палітрою під час
 * гідратації. Джерело правди — те саме, що в ThemeContext:
 * `veles_theme` = 'light' | 'dark' | 'system', за замовчуванням «системна».
 *
 * Достатньо класу на <html>: змінні звідти каскадують на все дерево, тож
 * body.light-theme у globals.css — лише дубль для випадків, коли клас ставить
 * контекст.
 *
 * Мову зазвичай уже виставив сервер із cookie. Скрипт потрібен лише першому
 * візиту, коли cookie ще немає: він визначає мову з браузера, ставить <html lang>
 * і ЗАПИСУЄ cookie — щоб наступне завантаження прийшло з сервера вже правильним
 * і спалах чужої мови трапився щонайбільше один раз на браузер.
 */
const themeBootstrap = `
(function(){try{
  var k=localStorage.getItem('veles_theme');
  var pref=(k==='light'||k==='dark'||k==='system')?k:'system';
  var t=pref==='system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')
    : pref;
  var d=document.documentElement;
  if(t==='light'){d.classList.add('light-theme');}
  d.dataset.theme=t;

  var S=['uk','en','pl','de','ro','cs','sk','hu','fr','es'];
  var m=document.cookie.match(/(?:^|; )veles_locale=([^;]*)/);
  var l=m?decodeURIComponent(m[1]):null;
  if(S.indexOf(l)===-1){
    l=localStorage.getItem('veles_locale');
    if(S.indexOf(l)===-1){
      l='en';
      var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
      for(var i=0;i<langs.length;i++){
        var c=String(langs[i]||'').split('-')[0].toLowerCase();
        if(S.indexOf(c)!==-1){l=c;break;}
      }
    }
    document.cookie='veles_locale='+l+'; path=/; max-age=31536000; samesite=lax';
  }
  d.lang=l;
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /*
    Мову беремо з cookie ще на сервері — тоді SSR-розмітка приходить одразу
    потрібною. Раніше сервер завжди віддавав українську, клієнт після
    гідратації перемикав мову й перемонтовував усе дерево: на кожному
    завантаженні сторінки блимав кадр чужою мовою.

    cookies() робить маршрут динамічним. Для цього застосунку це нічого не
    коштує: усі сторінки й так клієнтські та тягнуть дані запитами.
  */
  const saved = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      className={`${fontBody.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-page text-txt-primary antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
            <TourProvider>
              {children}
              {/* Global ⌘K — renders nothing until opened, and never on /login. */}
              <CommandPalette />
              {/* Onboarding: offered once per browser, restartable from the sidebar. */}
              <OnboardingTour />
              {/* Post-login branded splash — shown for 2 s when sessionStorage flag is set. */}
              <SplashScreen />
            </TourProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
