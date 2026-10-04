import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
});

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
};

/**
 * Anti-flash theme init (same contract as lib/theme.ts: localStorage 'theme'
 * = 'dark' | 'light'; absent = follow prefers-color-scheme).
 *
 * It MUST be a plain inline <script> as the first child of <head>, so the
 * browser runs it synchronously while parsing, before first paint. Do not
 * move it to next/script strategy="beforeInteractive": in Next 16 that is
 * queued via self.__next_s and run by the runtime chunk ~100-150 ms after
 * first paint, which flashes the light theme for dark-mode users.
 *
 * Trade-off: when React has to render this root layout on the client (e.g. a
 * client-rendered not-found / error recovery in dev), React 19 logs the
 * dev-only warning "Encountered a script tag while rendering React
 * component". It is harmless: the script already ran on the initial HTML
 * load and the `dark` class lives on <html> (suppressHydrationWarning).
 * No flash beats a dev-only console warning. CSP allows it via
 * script-src 'unsafe-inline' (next.config.ts).
 */
const themeInitScript =
  "(function(){try{var t=localStorage.getItem('theme');" +
  "if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))" +
  "document.documentElement.classList.add('dark')}catch(e){}})();";

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${cormorant.variable} ${inter.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-paper text-ink min-h-dvh">{children}</body>
    </html>
  );
}
