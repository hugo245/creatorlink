import type { Metadata, Viewport } from 'next';
import './globals.css';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: { default: 'CreatorLink: Hire Roblox creators. Pay when the video is live.', template: '%s · CreatorLink' },
  description:
    'The marketplace where Roblox developers book YouTube and TikTok creators for fixed-price promotions. Robux stays in escrow until you approve the delivery.',
  openGraph: { type: 'website', siteName: 'CreatorLink', title: 'CreatorLink: Hire Roblox creators', description: 'Fixed-price promos from vetted creators, protected by escrow.' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#FAF8F4', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
