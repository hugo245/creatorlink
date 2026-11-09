'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { LayoutDashboard, PackageOpen, Settings, ShieldCheck, Store, Wallet } from 'lucide-react';

export type NavItem = { href: string; label: string; short?: string; icon: 'home' | 'orders' | 'wallet' | 'listing' | 'settings' | 'admin'; badge?: number };
const ICONS = { home: LayoutDashboard, orders: PackageOpen, wallet: Wallet, listing: Store, settings: Settings, admin: ShieldCheck };

const isActive = (path: string, href: string) => (href === '/app' || href === '/admin' ? path === href : path.startsWith(href));

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-1" aria-label="App">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const on = isActive(path, i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}
            className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition', on ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-3')}>
            <Icon size={18} />
            <span className="flex-1">{i.label}</span>
            {!!i.badge && <span className={clsx('rounded-full px-1.5 text-[11px] font-bold tnum', on ? 'bg-signal text-white' : 'bg-signal-soft text-signal-dark')}>{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }} aria-label="App">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const on = isActive(path, i.href);
        return (
          <Link key={i.href} href={i.href} className={clsx('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', on ? 'text-signal' : 'text-ink-3')}>
            <Icon size={20} />{i.short ?? i.label}
            {!!i.badge && <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-signal" />}
          </Link>
        );
      })}
    </nav>
  );
}
