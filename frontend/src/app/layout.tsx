import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import CommandPalette from '@/components/ui/CommandPalette';

export const metadata: Metadata = {
  title: 'VELES ERP | Veles Bykovuna Fuels',
  description:
    'Аналітична платформа обліку палива: інтеграція OKKO ERP v2, Shell Mobility B2B та телематики Ruptela для автопарку ТОВ «Велес Буковина».',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070A10' },
    { media: '(prefers-color-scheme: light)', color: '#F4F6FA' },
  ],
};

/**
 * Applies the stored theme before first paint so the page never flashes
 * the wrong palette during hydration.
 */
const themeBootstrap = `
(function(){try{
  var k=localStorage.getItem('veles_theme')||localStorage.getItem('okko_theme');
  var t=(k==='light'||k==='dark')?k:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  if(t==='light'){document.documentElement.classList.add('light-theme');}
  document.documentElement.dataset.theme=t;
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-page text-txt-primary antialiased">
        <ThemeProvider>
          {children}
          {/* Global ⌘K — renders nothing until opened, and never on /login. */}
          <CommandPalette />
        </ThemeProvider>
      </body>
    </html>
  );
}
