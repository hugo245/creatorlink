'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession, hashPassword, verifyPassword, requireUser, revokeSessions, currentTokenHash } from '@/lib/auth';
import { get, run, now, uid } from '@/lib/db';
import { loginSchema, passwordSchema, profileSchema, signupSchema, zodErrors } from '@/lib/validators';
import { clientIp, hit } from '@/lib/ratelimit';
import { saveUpload, deleteUpload } from '@/lib/storage';
import { AppError } from '@/lib/ledger';
import type { ActionState } from '@/components/form';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/** Only allow same-site relative redirects. */
function safeNext(n: string, fallback: string) {
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : fallback;
}

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = { username: str(fd, 'username'), email: str(fd, 'email'), password: str(fd, 'password'), intent: str(fd, 'intent') || 'developer' };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error), values: { username: raw.username, email: raw.email } };
  const { username, email, password, intent } = parsed.data;

  if (!hit(`signup:${await clientIp()}`, 8, 60 * 60_000)) return { error: 'Too many sign-ups from this network. Try again later.' };
  if (get('SELECT 1 FROM users WHERE email = ?', email)) return { fields: { email: 'An account with this email already exists.' }, values: { username, email } };
  if (get('SELECT 1 FROM users WHERE username = ?', username)) return { fields: { username: 'That username is taken.' }, values: { username, email } };

  const id = uid();
  const isFirst = !get('SELECT 1 FROM users LIMIT 1');
  run(
    'INSERT INTO users (id, email, username, password_hash, role, created_at) VALUES (?,?,?,?,?,?)',
    id, email, username, await hashPassword(password), isFirst && process.env.FIRST_USER_IS_ADMIN === 'true' ? 'admin' : 'user', now(),
  );
  await createSession(id);
  redirect(intent === 'creator' ? '/app/creator' : '/app');
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = { email: str(fd, 'email'), password: str(fd, 'password') };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error), values: { email: raw.email } };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  if (!hit(`login:ip:${ip}`, 30, 15 * 60_000) || !hit(`login:email:${email}`, 8, 15 * 60_000)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.', values: { email } };
  }
  const user = get<{ id: string; password_hash: string; banned_at: number | null }>('SELECT id, password_hash, banned_at FROM users WHERE email = ?', email);
  // Always run a hash comparison so timing doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user?.password_hash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==');
  if (!user || !ok) return { error: 'Incorrect email or password.', values: { email } };
  if (user.banned_at) return { error: 'This account has been suspended. Contact support.', values: { email } };

  await createSession(user.id);
  redirect(safeNext(str(fd, 'next'), '/app'));
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ roblox_username: str(fd, 'roblox_username') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  let avatar = user.avatar;
  const file = fd.get('avatar');
  try {
    if (file instanceof File && file.size > 0) {
      const saved = await saveUpload(file, 'avatars', { imagesOnly: true, maxBytes: 2 * 1024 * 1024 });
      deleteUpload(user.avatar);
      avatar = saved.path;
    }
  } catch (e) {
    if (e instanceof AppError) return { fields: { avatar: e.message } };
    throw e;
  }
  run('UPDATE users SET roblox_username = ?, avatar = ? WHERE id = ?', parsed.data.roblox_username || null, avatar, user.id);
  return { ok: true, message: 'Profile saved.' };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ current: str(fd, 'current'), next: str(fd, 'next') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!hit(`pw:${user.id}`, 6, 15 * 60_000)) return { error: 'Too many attempts. Try again later.' };
  const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id)!;
  if (!(await verifyPassword(parsed.data.current, row.password_hash))) return { fields: { current: 'That password is incorrect.' } };
  run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(parsed.data.next), user.id);
  revokeSessions(user.id, await currentTokenHash());
  return { ok: true, message: 'Password updated. Other devices were signed out.' };
}
