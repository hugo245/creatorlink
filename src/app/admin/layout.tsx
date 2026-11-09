import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { get } from '@/lib/db';
import { Logo } from '@/components/logo';
import { AdminTabs } from './tabs';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const counts = (await get<{ c: number; d: number; p: number; r: number }>(
    `SELECT (SELECT COUNT(*) FROM creators WHERE status = 'pending') c,
            (SELECT COUNT(*) FROM orders WHERE status = 'disputed') d,
            (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending') p,
            (SELECT COUNT(*) FROM reports WHERE status = 'open') r`,
  ))!;
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4"><Logo href="/admin" light /><span className="badge bg-signal text-white">Admin</span></div>
          <Link href="/app" className="text-sm font-medium text-paper/70 hover:text-paper">← Back to app</Link>
        </div>
      </header>
      <AdminTabs counts={counts} />
      <main className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
