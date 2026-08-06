import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/context/I18nContext';
import { TourProvider } from '@/context/TourContext';
import { t } from '@/lib/i18n';
import CommandPalette from '@/components/ui/CommandPalette';
import OnboardingTour from '@/components/OnboardingTour';
import SplashScreen from '@/components/SplashScreen';

/**
 * Метадані рендеряться на сервері під час збірки, коли мови користувача ще
 * немає, — тому тут завжди українська (t() без обраної мови повертає uk).
 * Перекласти опис під кожну мову можна лише окремими маршрутами /en, /pl,
 * від яких ця збірка навмисно відмовилась.
 */
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
 * Цей самий скрипт виставляє <html lang>: збережений вибір, інакше перша
 * підтримувана мова браузера, інакше 'en'. Той самий порядок, що і в
 * I18nProvider/detectLocale — розійтись вони не мають, бо lang читають
 * зчитувачі екрана й вбудований перекладач браузера ще до запуску React
 * (і саме він вирішує, чи запропонувати «перекласти цю сторінку»).
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

  var S=['uk','en','pl','de'];
  var l=localStorage.getItem('veles_locale');
  if(S.indexOf(l)===-1){
    l='en';
    var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
    for(var i=0;i<langs.length;i++){
      var c=String(langs[i]||'').split('-')[0].toLowerCase();
      if(S.indexOf(c)!==-1){l=c;break;}
    }
  }
  d.lang=l;
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-page text-txt-primary antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
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
