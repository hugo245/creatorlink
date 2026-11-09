import { z } from 'zod';

export const NICHES = [
  'Obby', 'Tycoon', 'Simulator', 'Horror', 'RPG', 'Anime', 'Shooter', 'Tower Defense',
  'Roleplay', 'Fighting', 'Racing', 'Sandbox', 'Survival', 'Story',
] as const;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const text = (min: number, max: number, label: string) =>
  z.string().transform(clean).pipe(
    z.string().min(min, `${label} is too short.`).max(max, `${label} must be under ${max} characters.`),
  );
const multiline = (max: number, label: string) =>
  z.string().transform((s) => s.replace(/\r\n/g, '\n').trim()).pipe(z.string().max(max, `${label} must be under ${max} characters.`));

const httpUrl = (label: string) =>
  z.string().trim().max(300).refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, `${label} must be a full link starting with https://`);

const hostIn = (hosts: string[]) => (v: string) => {
  try {
    const h = new URL(v).hostname.replace(/^www\./, '').replace(/^m\./, '');
    return hosts.some((x) => h === x || h.endsWith('.' + x));
  } catch {
    return false;
  }
};

export const signupSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,20}$/, 'Username: 3–20 letters, numbers or underscores.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  intent: z.enum(['developer', 'creator']).default('developer'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const gameUrlSchema = httpUrl('Game link').refine(
  hostIn(['roblox.com', 'ro.blox.com']),
  'Use a link to your game on roblox.com.',
);

export const orderSchema = z.object({
  packageId: z.string().min(1),
  gameName: text(2, 60, 'Game name'),
  gameUrl: gameUrlSchema,
  brief: multiline(1500, 'Brief').pipe(z.string().min(20, 'Tell the creator a bit more, at least 20 characters.')),
});

export const deliverSchema = z.object({
  url: httpUrl('Delivery link').refine(
    hostIn(['youtube.com', 'youtu.be', 'tiktok.com', 'vm.tiktok.com', 'drive.google.com', 'streamable.com', 'medal.tv', 'cdn.discordapp.com']),
    'Link a YouTube, TikTok, Drive, Streamable or Medal URL.',
  ),
  note: multiline(800, 'Note'),
});

export const reasonSchema = (label = 'Reason') => text(10, 600, label);

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  body: multiline(800, 'Review'),
});

export const profileSchema = z.object({
  roblox_username: z.string().trim().max(20).regex(/^[A-Za-z0-9_]*$/, 'Roblox usernames use letters, numbers and underscores.').optional().default(''),
});

export const passwordSchema = z.object({
  current: z.string().min(1, 'Enter your current password.'),
  next: z.string().min(8, 'New password must be at least 8 characters.').max(200),
});

export const channelLinkSchema = z.object({
  platform: z.enum(['youtube', 'tiktok']),
  url: z.string().trim().min(2, 'Paste your channel link.').max(300),
});

export const creatorDetailsSchema = z.object({
  headline: text(10, 90, 'Headline'),
  bio: multiline(1200, 'Bio').pipe(z.string().min(40, 'Write at least 40 characters about your content.')),
  niches: z.array(z.enum(NICHES)).min(1, 'Pick at least one genre.').max(5, 'Pick up to 5 genres.'),
});

export const packageSchema = z.object({
  title: text(3, 60, 'Title'),
  description: multiline(400, 'Description'),
  currency: z.enum(['ROBUX', 'USD']),
  price: z.coerce.number().positive('Enter a price.').max(1_000_000),
  deliveryDays: z.coerce.number().int().min(1).max(60),
  revisions: z.coerce.number().int().min(0).max(10),
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().int().min(1, 'Enter an amount.'),
  gamepass: z.string().trim().min(1, 'Enter your gamepass link.').max(300),
});

export const usdWithdrawSchema = z.object({ amount: z.coerce.number().positive('Enter an amount.').max(100_000) });

export const depositSchema = z.object({
  amount: z.coerce.number().int().min(100, 'Minimum deposit is R$ 100.').max(10_000_000),
  reference: text(3, 120, 'Reference'),
});

export const usdDepositSchema = z.object({ amount: z.coerce.number().min(5, 'Minimum deposit is $5.').max(1000, 'Maximum deposit is $1,000.') });

export const reportSchema = z.object({
  reason: z.enum(['impersonation', 'scam', 'fake_stats', 'off_platform', 'abuse', 'other']),
  details: multiline(800, 'Details'),
});

export type FieldErrors = Record<string, string>;

export function zodErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? '_');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'creator';
