import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { MobileNav } from './mobile-nav';

const LINKS = [
  { href: '/creators', label: 'Browse creators' },
  { href: '/#how', label: 'How it works' },
  { href: '/#escrow', label: 'Escrow' },
  { href: '/#faq', label: 'FAQ' },
];

export async function Header() {
  const user = await getUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-paper-2 hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/app" className="btn btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Log in</Link>
              <Link href="/signup" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>
        <MobileNav links={LINKS} authed={!!user} />
      </div>
    </header>
  );
}
