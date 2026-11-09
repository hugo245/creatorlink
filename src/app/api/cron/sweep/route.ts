import { NextResponse } from 'next/server';
import { sweepOrders } from '@/lib/orders';
import { purgeExpiredSessions } from '@/lib/auth';
import { sweepRateLimits } from '@/lib/ratelimit';
import { run, now } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Time-based jobs: refund unanswered orders, auto-release stale deliveries, clear expired rows.
 * Call every 5-15 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await sweepOrders(true);
  await purgeExpiredSessions();
  await sweepRateLimits();
  await run('DELETE FROM password_resets WHERE expires_at < ?', now() - 86_400_000);
  return NextResponse.json({ ok: true, ...result });
}
