import 'server-only';
import { headers } from 'next/headers';
import { get, run, now } from './db';

/** Fixed-window limiter backed by SQLite, so it holds across restarts. Returns false when over the limit. */
export function hit(key: string, max: number, windowMs: number): boolean {
  const t = now();
  const row = get<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', key);
  if (!row || row.reset_at < t) {
    run('INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?,1,?)', key, t + windowMs);
    return true;
  }
  if (row.count >= max) return false;
  run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', key);
  return true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim();
}

export function sweepRateLimits() {
  run('DELETE FROM rate_limits WHERE reset_at < ?', now());
}
