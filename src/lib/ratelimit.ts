import 'server-only';
import { headers } from 'next/headers';
import { get, run, now } from './db';

/** Fixed-window limiter backed by SQLite, so it holds across restarts. Returns false when over the limit. */
export async function hit(key: string, max: number, windowMs: number): Promise<boolean> {
  const t = now();
  // One atomic upsert: start a new window if the old one expired, otherwise bump the counter.
  const row = await get<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at < ? THEN ? ELSE rate_limits.reset_at END
     RETURNING count`,
    key, t + windowMs, t, t, t + windowMs,
  );
  return (row?.count ?? 1) <= max;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim();
}

export function sweepRateLimits() {
  return run('DELETE FROM rate_limits WHERE reset_at < ?', now());
}
