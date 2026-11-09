import { createHash, randomBytes } from 'node:crypto';
import { all, get, run, now } from './db';
import { AppError } from './ledger';

/* -------------------------------------------------------------------------
 * Anti-impersonation: usernames and creator names are compared by a "skeleton"
 * that collapses look-alike characters, case, separators and repeats, so
 * "K41_Plays", "kaiplays" and "KaiPIays" are all the same identity.
 * ---------------------------------------------------------------------- */

const CONFUSABLE: Record<string, string> = {
  '0': 'o', '1': 'l', i: 'l', '|': 'l', '!': 'l', '3': 'e', '4': 'a', '@': 'a', '5': 's', $: 's', '7': 't', '8': 'b',
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c', '\u0445': 'x', '\u0443': 'y', '\u0456': 'l', // Cyrillic look-alikes
};

/** Canonical form for comparing usernames: case, accents, separators, look-alike characters and repeats are ignored. */
export function skeleton(input: string): string {
  let s = input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/vv/g, 'w').replace(/rn/g, 'm').replace(/ph/g, 'f');
  s = [...s].map((c) => CONFUSABLE[c] ?? c).join('');
  s = s.replace(/[^a-z0-9]/g, ''); // drop separators and emoji; other digits stay, so john1 and john2 remain different people
  return s.replace(/(.)\1+/g, '$1');
}

/** Like skeleton, but also ignores trailing numbers/separators ("KaiPlays2", "Kai Plays _"), the classic copycat trick. */
export function creatorSkeleton(name: string): string {
  return skeleton(name.replace(/[\s\d_.\-]+$/, ''));
}

/** Words nobody but the platform may use in a name. Matched against the skeleton. */
const BRAND_WORDS = ['creatorlink', 'roblox', 'robux', 'official', 'staff', 'support', 'admin', 'moderator', 'helpdesk', 'billing', 'security'].map(skeleton);
/** Obvious abuse terms. Matched against the skeleton. */
const ABUSE = ['fuck', 'shit', 'nigg', 'fagg', 'cunt', 'rape', 'nazi', 'hitler', 'bitch', 'whore', 'slut', 'pedo', 'molest', 'kys', 'scam'].map(skeleton);

export function checkUsername(name: string): string | null {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return 'Username: 3–20 letters, numbers or underscores.';
  if (/^_|_$|__/.test(name)) return 'Underscores can’t start, end or repeat in a username.';
  if (/(.)\1{3,}/i.test(name)) return 'That username has too many repeated characters.';
  if ((name.match(/[A-Za-z]/g) ?? []).length < 2) return 'Usernames need at least 2 letters.';
  const sk = skeleton(name);
  if (sk.length < 3) return 'Choose a more distinctive username.';
  if (BRAND_WORDS.some((w) => sk.includes(w))) return 'That username isn’t available. It could be mistaken for CreatorLink or Roblox staff.';
  if (ABUSE.some((w) => sk.includes(w))) return 'Please choose a different username.';
  return null;
}

/** Returns the existing username this one collides with, if any. */
export async function usernameLookalike(name: string, ignoreUserId = ''): Promise<boolean> {
  const row = await get('SELECT 1 AS x FROM users WHERE username_skeleton = ? AND id != ?', skeleton(name), ignoreUserId);
  return !!row;
}

/** Names of approved creators whose name looks like `name`. Used to flag possible impersonation for admin review. */
export async function similarCreators(name: string, ignoreCreatorId = ''): Promise<string[]> {
  const target = creatorSkeleton(name);
  if (target.length < 3) return [];
  const rows = await all<{ display_name: string }>("SELECT display_name FROM creators WHERE status = 'approved' AND id != ?", ignoreCreatorId);
  return rows.filter((c) => creatorSkeleton(c.display_name) === target).map((c) => c.display_name);
}

export function nameFlags(name: string): string[] {
  const sk = skeleton(name);
  const flags: string[] = [];
  if (BRAND_WORDS.some((w) => sk.includes(w))) flags.push('Name contains a reserved/brand word');
  if (ABUSE.some((w) => sk.includes(w))) flags.push('Name contains offensive language');
  return flags;
}

/* ---------------------------------------------------------------- verification codes */

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function newChannelCode() {
  return `CL-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createEmailToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await run('INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?,?,?)', hashToken(token), userId, now() + 48 * 3_600_000);
  return token;
}

export async function consumeEmailToken(token: string): Promise<boolean> {
  const row = await get<{ user_id: string }>(
    'UPDATE email_verifications SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id',
    now(), hashToken(token), now(),
  );
  if (!row) return false;
  await run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', now(), row.user_id);
  return true;
}

/** Throws unless the user's email is verified. Gate anything involving money or public listings. */
export function assertEmailVerified(user: { email_verified_at: number | null }) {
  if (!user.email_verified_at) throw new AppError('Please verify your email address first. Check your inbox or resend the link from your dashboard.');
}
