import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { sweepOrders } from '@/lib/orders';
import { Logo } from '@/components/logo';
import { Avatar } from '@/components/avatar';
import { DualMoney } from '@/components/ui';
import { VerifyBanner } from '@/components/app/verify-banner';
import { NotificationBell, type Notif } from '@/components/app/notification-bell';
import { SideNav, TabBar, type NavItem } from '@/components/app/nav';
import { logout } from '@/app/actions/auth';
import { LogOut } from 'lucide-react';

export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s · CreatorLink' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await sweepOrders();
  const user = await requireUser();
  const notifs = await all<Notif>('SELECT id, title, body, href, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 12', user.id);
  const unread = (await get<{ n: number }>('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id))!.n;
  const needsAction = (await get<{ n: number }>(
    `SELECT COUNT(*) n FROM orders WHERE (seller_user_id = ? AND status = 'pending') OR (buyer_id = ? AND status = 'delivered')`,
    user.id, user.id,
  ))!.n;

  const items: NavItem[] = [
    { href: '/app', label: 'Overview', icon: 'home' },
    { href: '/app/orders', label: 'Orders', icon: 'orders', badge: needsAction || undefined },
    { href: '/app/wallet', label: 'Wallet', icon: 'wallet' },
    { href: '/app/creator', label: user.creator_id ? 'My listing' : 'Become a creator', short: user.creator_id ? 'Listing' : 'Creator', icon: 'listing' },
    { href: '/app/settings', label: 'Settings', icon: 'settings' },
  ];
  if (user.role === 'admin') items.push({ href: '/admin', label: 'Admin', icon: 'admin' });
  const tabs = items.filter((i) => i.icon !== 'settings' || items.length <= 5).slice(0, 5);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-paper-2/70 p-5 lg:flex">
        <Logo href="/app" />
        <div className="mt-8 flex-1"><SideNav items={items} /></div>
        <Link href="/creators" className="btn btn-outline mb-4 w-full">Browse marketplace</Link>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Avatar name={user.username} src={user.avatar} size={36} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold leading-tight">{user.username}</p><p className="truncate text-xs text-ink-3">{user.email}</p></div>
          <form action={logout}><button className="btn btn-ghost h-8 w-8 px-0" aria-label="Log out" title="Log out"><LogOut size={16} /></button></form>
        </div>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-5 backdrop-blur sm:px-8">
          <div className="lg:hidden"><Logo href="/app" markOnlyMobile /></div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <Link href="/app/wallet" className="btn btn-outline btn-sm" title="Wallet balance"><Wallet2 /> <DualMoney robux={user.balance} usd={user.balance_usd} /></Link>
            <NotificationBell items={notifs} unread={unread} />
            <form action={logout} className="lg:hidden"><button className="btn btn-ghost h-10 w-10 px-0" aria-label="Log out"><LogOut size={18} /></button></form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 sm:py-10">
          {!user.email_verified_at && <VerifyBanner email={user.email} />}
          {children}
        </main>
      </div>
      <TabBar items={tabs} />
    </div>
  );
}

function Wallet2() {
  return <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden />;
}
