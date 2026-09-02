import type { Metadata } from 'next';
import './globals.css';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
import { Cursor } from '@/components/ui/Cursor';
import { Preloader } from '@/components/ui/Preloader';
import { BUSINESS } from '@/lib/constants';

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
    <html lang="en">
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
