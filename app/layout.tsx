import type { Metadata } from 'next';
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
import { Cursor } from '@/components/ui/Cursor';
import { Preloader } from '@/components/ui/Preloader';
import { BUSINESS } from '@/lib/constants';

/**
 * Typography, chosen off lusion.co's own stack.
 *
 * Lusion sets its display and body copy in Aeonik and its small print in
 * IBM Plex Mono. Aeonik is a commercial licence from CoType Foundry —
 * their site serves it from their own domain under that licence, and
 * lifting the files would be using a font we have not paid for, so it is
 * not an option for a site we intend to hand to a client.
 *
 * Schibsted Grotesk is the closest free equivalent: the same geometric
 * grotesque construction, near-identical proportions, and the slightly
 * warm, low-contrast finish that makes Aeonik read as modern rather than
 * corporate. IBM Plex Mono is the font Lusion actually uses for its mono
 * details and is openly licensed, so that half of their pairing is exact.
 *
 * Both are self-hosted by next/font at build time — no request to Google
 * at runtime, and no layout shift, because the metrics are known.
 */
const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${BUSINESS.name} — Moving, Packing & Storage in Lewisville, TX`,
  description:
    'Local and long-distance movers serving Lewisville and the greater DFW area. Residential, commercial, packing, and climate-controlled storage.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="relative">
        <SmoothScrollProvider>
          <SceneCanvas />
          <div className="relative z-10">{children}</div>
          {/* Above everything, including the nav, so the cursor is never
              occluded by page chrome. */}
          <Cursor />
          {/* Mounted last and painted above everything, including the
              cursor layer. Client-side navigation between routes does
              not remount the layout, so this runs once per page load. */}
          <Preloader />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
