import Link from 'next/link';
import { Logo } from '@/components/logo';
import { config } from '@/lib/config';

const COLS = [
  { title: 'Marketplace', links: [['Browse creators', '/creators'], ['How it works', '/#how'], ['Escrow protection', '/#escrow'], ['Become a creator', '/signup?intent=creator']] },
  { title: 'Company', links: [['Safety & disputes', '/safety'], ['Terms of service', '/terms'], ['Privacy policy', '/privacy']] },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className="container-x grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            The marketplace where Roblox developers hire YouTube and TikTok creators, with every Robux protected by escrow until the work is approved.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="eyebrow mb-4">{c.title}</h4>
            <ul className="space-y-2.5 text-sm">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-ink-2 transition hover:text-signal">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-ink-3 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} CreatorLink. Not affiliated with Roblox Corporation, YouTube or TikTok.</span>
          <a href={`mailto:${config.supportEmail}`} className="hover:text-ink">{config.supportEmail}</a>
        </div>
      </div>
    </footer>
  );
}
