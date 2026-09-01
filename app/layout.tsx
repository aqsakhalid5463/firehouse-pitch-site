import type { Metadata } from 'next';
import './globals.css';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
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
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
