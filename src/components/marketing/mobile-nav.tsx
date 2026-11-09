'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export function MobileNav({ links, authed }: { links: { href: string; label: string }[]; authed: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(!open)} className="btn btn-ghost h-10 w-10 px-0" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 animate-fade bg-paper px-5 pb-8 pt-4">
          <nav className="flex flex-col" aria-label="Mobile">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-line py-4 font-display text-xl font-semibold">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid gap-3">
            {authed ? (
              <Link href="/app" onClick={() => setOpen(false)} className="btn btn-primary btn-lg">Open dashboard</Link>
            ) : (
              <>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-primary btn-lg">Get started</Link>
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-outline btn-lg">Log in</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
