'use server';

import { redirect } from 'next/navigation';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '@/lib/config';
import { emailConfigured, sendEmail } from '@/lib/email';
import { assertEmailVerified, checkUsername, consumeEmailToken, createEmailToken, skeleton, usernameLookalike } from '@/lib/identity';
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

async function sendVerification(userId: string, email: string) {
  const token = await createEmailToken(userId);
  await sendEmail(email, 'Verify your CreatorLink email', `Welcome to CreatorLink.\n\nConfirm your email address: ${config.appUrl}/verify-email/${token}\n\nThis link expires in 48 hours.`);
}

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = { username: str(fd, 'username'), email: str(fd, 'email'), password: str(fd, 'password'), intent: str(fd, 'intent') || 'developer' };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error), values: { username: raw.username, email: raw.email } };
  const { username, email, password, intent } = parsed.data;

  const bad = checkUsername(username);
  if (bad) return { fields: { username: bad }, values: { username, email } };
  if (!(await hit(`signup:${await clientIp()}`, 8, 60 * 60_000))) return { error: 'Too many sign-ups from this network. Try again later.' };
  if (await get('SELECT 1 AS x FROM users WHERE lower(email) = lower(?)', email)) return { fields: { email: 'An account with this email already exists.' }, values: { username, email } };
  if ((await get('SELECT 1 AS x FROM users WHERE lower(username) = lower(?)', username)) || (await usernameLookalike(username))) {
    return { fields: { username: 'That username is taken or too similar to an existing one.' }, values: { username, email } };
  }

  const id = uid();
  const isFirst = !(await get('SELECT 1 AS x FROM users LIMIT 1'));
  // Without an email provider (local development) there is nobody to send a link, so verify immediately.
  const autoVerify = !emailConfigured && !config.isProd;
  try {
    await run(
      'INSERT INTO users (id, email, username, username_skeleton, password_hash, role, email_verified_at, created_at) VALUES (?,?,?,?,?,?,?,?)',
      id, email, username, skeleton(username), await hashPassword(password), isFirst && process.env.FIRST_USER_IS_ADMIN === 'true' ? 'admin' : 'user', autoVerify ? now() : null, now(),
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { fields: { username: 'That username or email is already taken.' }, values: { username, email } };
    throw e;
  }
  if (!autoVerify) await sendVerification(id, email);
  await createSession(id);
  redirect(intent === 'creator' ? '/app/creator' : '/app');
}

export async function resendVerification(): Promise<ActionState> {
  const user = await requireUser();
  if (user.email_verified_at) return { ok: true, message: 'Your email is already verified.' };
  if (!(await hit(`verify-resend:${user.id}`, 3, 60 * 60_000))) return { error: 'Please wait a bit before requesting another email.' };
  if (!emailConfigured && config.isProd) return { error: 'Email sending isn’t configured on this server. Contact support.' };
  await sendVerification(user.id, user.email);
  return { ok: true, message: 'Verification email sent. Check your inbox.' };
}

export async function verifyEmail(token: string): Promise<ActionState> {
  if (!(await hit(`verify-email:${await clientIp()}`, 20, 60 * 60_000))) return { error: 'Too many attempts. Try again later.' };
  return (await consumeEmailToken(token)) ? { ok: true, message: 'Email verified.' } : { error: 'This link is invalid or has expired. Request a new one from your dashboard.' };
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const raw = { email: str(fd, 'email'), password: str(fd, 'password') };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error), values: { email: raw.email } };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  if (!(await hit(`login:ip:${ip}`, 30, 15 * 60_000)) || !(await hit(`login:email:${email}`, 8, 15 * 60_000))) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.', values: { email } };
  }
  const user = await get<{ id: string; password_hash: string; banned_at: number | null }>('SELECT id, password_hash, banned_at FROM users WHERE lower(email) = lower(?)', email);
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
      await deleteUpload(user.avatar);
      avatar = saved.path;
    }
  } catch (e) {
    if (e instanceof AppError) return { fields: { avatar: e.message } };
    throw e;
  }
  await run('UPDATE users SET roblox_username = ?, avatar = ? WHERE id = ?', parsed.data.roblox_username || null, avatar, user.id);
  return { ok: true, message: 'Profile saved.' };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ current: str(fd, 'current'), next: str(fd, 'next') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`pw:${user.id}`, 6, 15 * 60_000))) return { error: 'Too many attempts. Try again later.' };
  const row = (await get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id))!;
  if (!(await verifyPassword(parsed.data.current, row.password_hash))) return { fields: { current: 'That password is incorrect.' } };
  await run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(parsed.data.next), user.id);
  await revokeSessions(user.id, await currentTokenHash());
  return { ok: true, message: 'Password updated. Other devices were signed out.' };
}

/* ---------------------------------------------------------- password reset */

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email').trim().toLowerCase();
  const generic: ActionState = { ok: true, message: 'If an account exists for that email, a reset link is on its way. It expires in one hour.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { fields: { email: 'Enter a valid email address.' } };
  if (!(await hit(`reset:ip:${await clientIp()}`, 10, 60 * 60_000)) || !(await hit(`reset:email:${email}`, 3, 60 * 60_000))) return generic;
  const user = await get<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?) AND banned_at IS NULL', email);
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', createHash('sha256').update(token).digest('hex'), user.id, now() + 60 * 60_000);
    await sendEmail(email, 'Reset your CreatorLink password', `Someone asked to reset the password for your CreatorLink account.\n\nChoose a new password: ${config.appUrl}/reset/${token}\n\nThis link expires in one hour. If it wasn't you, you can ignore this email.`);
  }
  return generic;
}

export async function resetPassword(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const password = str(fd, 'password');
  if (password.length < 8 || password.length > 200) return { fields: { password: 'Password must be at least 8 characters.' } };
  if (!(await hit(`reset-submit:${await clientIp()}`, 20, 60 * 60_000))) return { error: 'Too many attempts. Try again later.' };
  const hash = createHash('sha256').update(token).digest('hex');
  // Single-use: the UPDATE only matches an unused, unexpired token, so concurrent submits can't both win.
  const row = await get<{ user_id: string }>('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id', now(), hash, now());
  if (!row) return { error: 'This reset link is invalid or has expired. Request a new one.' };
  await run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(password), row.user_id);
  await revokeSessions(row.user_id);
  redirect('/login?reset=1');
}
