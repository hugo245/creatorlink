import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createHash, randomBytes } from 'node:crypto';
import { get, run, now } from './db';
import { config, DAY } from './config';
export { hashPassword, verifyPassword } from './password';

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  roblox_username: string | null;
  avatar: string | null;
  balance: number;
  banned_at: number | null;
  creator_id: string | null;
  creator_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  creator_slug: string | null;
};

const COOKIE = 'cl_session';
const SESSION_DAYS = 30;
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const h = await headers();
  run(
    'INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent) VALUES (?,?,?,?,?)',
    hashToken(token),
    userId,
    now() + SESSION_DAYS * DAY,
    now(),
    (h.get('user-agent') || '').slice(0, 200),
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd && config.appUrl.startsWith('https'),
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run('DELETE FROM sessions WHERE id = ?', hashToken(token));
  jar.delete(COOKIE);
}

/** Current user (or null). Memoised per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = get<SessionUser & { expires_at: number }>(
    `SELECT u.id, u.email, u.username, u.role, u.roblox_username, u.avatar, u.balance, u.banned_at,
            c.id AS creator_id, c.status AS creator_status, c.slug AS creator_slug, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       LEFT JOIN creators c ON c.user_id = u.id
      WHERE s.id = ?`,
    hashToken(token),
  );
  if (!row || row.expires_at < now() || row.banned_at) return null;
  return row;
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/app');
  return u;
}

/** Revoke every session for a user, optionally keeping the one identified by `keepHash`. */
export function revokeSessions(userId: string, keepHash?: string | null) {
  if (keepHash) run('DELETE FROM sessions WHERE user_id = ? AND id != ?', userId, keepHash);
  else run('DELETE FROM sessions WHERE user_id = ?', userId);
}

export async function currentTokenHash() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  return t ? hashToken(t) : null;
}

export function purgeExpiredSessions() {
  run('DELETE FROM sessions WHERE expires_at < ?', now());
}
