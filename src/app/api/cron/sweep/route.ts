import { NextResponse } from 'next/server';
import { sweepOrders } from '@/lib/orders';
import { purgeExpiredSessions } from '@/lib/auth';
import { sweepRateLimits } from '@/lib/ratelimit';
import { all, run, now } from '@/lib/db';
import { fetchTikTok, fetchYouTube } from '@/lib/channels';
import { updateStats } from '@/lib/creators';

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
  // Keep verified creators' numbers fresh (oldest first, capped to stay inside API quotas and the function timeout).
  let refreshed = 0;
  const stale = await all<{ id: string; youtube_url: string | null; youtube_verified_at: number | null; tiktok_handle: string | null; tiktok_verified_at: number | null }>(
    `SELECT id, youtube_url, youtube_verified_at, tiktok_handle, tiktok_verified_at FROM creators
      WHERE status = 'approved' AND (youtube_verified_at IS NOT NULL OR tiktok_verified_at IS NOT NULL)
      ORDER BY LEAST(COALESCE(youtube_synced_at, 0), COALESCE(tiktok_synced_at, 0)) LIMIT 25`,
  );
  for (const c of stale) {
    try {
      if (c.youtube_verified_at && c.youtube_url && process.env.YOUTUBE_API_KEY) await updateStats(c.id, 'youtube', await fetchYouTube(c.youtube_url));
      if (c.tiktok_verified_at && c.tiktok_handle) await updateStats(c.id, 'tiktok', await fetchTikTok(c.tiktok_handle)).catch(() => {});
      refreshed++;
    } catch (e) {
      console.error('[cron] stats refresh failed', c.id, e instanceof Error ? e.message : e);
    }
  }
  await run('DELETE FROM email_verifications WHERE expires_at < ?', now() - 7 * 86_400_000);
  return NextResponse.json({ ok: true, ...result, refreshed });
}
