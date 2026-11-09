'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export function AdminTabs({ counts }: { counts: { c: number; d: number; p: number; r: number } }) {
  const path = usePathname();
  const tabs = [
    ['/admin', 'Overview', 0], ['/admin/creators', 'Creators', counts.c], ['/admin/disputes', 'Disputes', counts.d],
    ['/admin/payments', 'Payments', counts.p], ['/admin/reports', 'Reports', counts.r], ['/admin/users', 'Users', 0],
  ] as const;
  return (
    <nav className="border-b border-line bg-white" aria-label="Admin">
      <div className="mx-auto flex max-w-[1180px] gap-1 overflow-x-auto px-5 sm:px-8">
        {tabs.map(([href, label, n]) => {
          const on = href === '/admin' ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className={clsx('flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-semibold transition', on ? 'border-signal text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
              {label}{n > 0 && <span className="rounded-full bg-signal px-1.5 text-[11px] font-bold text-white tnum">{n}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
