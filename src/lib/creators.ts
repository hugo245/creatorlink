import { all, get, run, tx, now, uid } from './db';
import { config } from './config';
import { AppError, audit, notify, notifyAdmins } from './ledger';
import { slugify } from './validators';
import { newChannelCode, nameFlags, similarCreators } from './identity';
import { MIN_PRICE, type Currency } from './money';
import type { TikTokProfile, YouTubeChannel } from './channels';

export type Creator = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  headline: string;
  bio: string;
  platform: 'youtube' | 'tiktok' | 'both';
  youtube_url: string | null;
  tiktok_url: string | null;
  followers: number;
  avg_views: number;
  niches: string[];
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  review_note: string | null;
  review_flags: string[];
  is_listed: number;
  completed_orders: number;
  rating_sum: number;
  rating_count: number;
  created_at: number;
  approved_at: number | null;
  verification_code: string | null;
  youtube_channel_id: string | null;
  youtube_title: string | null;
  youtube_thumb: string | null;
  youtube_verified_at: number | null;
  youtube_subs: number | null;
  youtube_total_views: number | null;
  youtube_video_count: number | null;
  youtube_avg_views: number | null;
  youtube_synced_at: number | null;
  tiktok_handle: string | null;
  tiktok_title: string | null;
  tiktok_verified_at: number | null;
  tiktok_followers: number | null;
  tiktok_likes: number | null;
  tiktok_video_count: number | null;
  tiktok_avg_views: number | null;
  tiktok_synced_at: number | null;
  username: string;
  avatar: string | null;
  min_price: number | null;
  min_price_currency: Currency | null;
  verified: boolean;
};

export type Pkg = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  delivery_days: number;
  revisions: number;
  active: number;
  position: number;
};

type Raw = Omit<Creator, 'niches' | 'review_flags' | 'verified'> & { niches: string; review_flags: string | null };

function safeJson(s: string | null): string[] {
  try {
    const v = JSON.parse(s ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
const parse = (r: Raw): Creator => ({
  ...r,
  niches: safeJson(r.niches),
  review_flags: safeJson(r.review_flags),
  verified: !!(r.youtube_verified_at || r.tiktok_verified_at),
});

/** USD-equivalent of a package price, for sorting/filtering across currencies only. */
const USD_EQ = `(CASE p.currency WHEN 'USD' THEN p.price / 100.0 ELSE p.price * ${Number(config.robuxUsdRate)} END)`;

const SELECT = `
  SELECT c.*, u.username, u.avatar, mp.price AS min_price, mp.currency AS min_price_currency
    FROM creators c JOIN users u ON u.id = c.user_id
    LEFT JOIN LATERAL (
      SELECT p.price, p.currency, ${USD_EQ} AS usd_eq FROM packages p
       WHERE p.creator_id = c.id AND p.active = 1 ORDER BY ${USD_EQ} LIMIT 1
    ) mp ON true`;

export type Filters = {
  q?: string;
  platform?: 'youtube' | 'tiktok';
  niche?: string;
  currency?: Currency;
  maxUsd?: number;
  sort?: 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'audience';
  page?: number;
  perPage?: number;
};

export async function listCreators(f: Filters = {}) {
  const where = ["c.status = 'approved'", 'c.is_listed = 1', 'mp.price IS NOT NULL'];
  const args: (string | number)[] = [];
  if (f.q) {
    where.push('(lower(c.display_name) LIKE ? OR lower(c.headline) LIKE ? OR lower(c.bio) LIKE ? OR lower(c.niches) LIKE ?)');
    const like = `%${f.q.replace(/[%_\\]/g, '').toLowerCase()}%`;
    args.push(like, like, like, like);
  }
  if (f.platform) {
    where.push("(c.platform = ? OR c.platform = 'both')");
    args.push(f.platform);
  }
  if (f.niche) {
    where.push('c.niches LIKE ?');
    args.push(`%"${f.niche.replace(/["%_]/g, '')}"%`);
  }
  if (f.currency) {
    where.push('EXISTS (SELECT 1 FROM packages p WHERE p.creator_id = c.id AND p.active = 1 AND p.currency = ?)');
    args.push(f.currency);
  }
  if (f.maxUsd) {
    where.push('mp.usd_eq <= ?');
    args.push(f.maxUsd);
  }
  const order =
    {
      popular: 'c.completed_orders DESC, c.rating_count DESC',
      rating: '(CASE WHEN c.rating_count = 0 THEN 0 ELSE 1.0 * c.rating_sum / c.rating_count END) DESC, c.rating_count DESC',
      price_asc: 'mp.usd_eq ASC',
      price_desc: 'mp.usd_eq DESC',
      newest: 'c.approved_at DESC NULLS LAST',
      audience: 'c.followers DESC',
    }[f.sort ?? 'popular'] + ', c.created_at DESC';
  const perPage = f.perPage ?? 12;
  const page = Math.max(1, f.page ?? 1);
  const base = `FROM creators c LEFT JOIN LATERAL (SELECT p.price, ${USD_EQ} AS usd_eq FROM packages p WHERE p.creator_id = c.id AND p.active = 1 ORDER BY ${USD_EQ} LIMIT 1) mp ON true WHERE ${where.join(' AND ')}`;
  const total = (await get<{ n: number }>(`SELECT COUNT(*) AS n ${base}`, ...args))!.n;
  const rows = await all<Raw>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, perPage, (page - 1) * perPage);
  return { creators: rows.map(parse), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function featuredCreators(n = 4) {
  return (await listCreators({ sort: 'popular', perPage: n })).creators;
}

export async function getCreatorBySlug(slug: string) {
  const r = await get<Raw>(`${SELECT} WHERE lower(c.slug) = lower(?)`, slug);
  return r ? parse(r) : undefined;
}

export async function getCreatorByUser(userId: string) {
  const r = await get<Raw>(`${SELECT} WHERE c.user_id = ?`, userId);
  return r ? parse(r) : undefined;
}

export async function getCreatorById(id: string) {
  const r = await get<Raw>(`${SELECT} WHERE c.id = ?`, id);
  return r ? parse(r) : undefined;
}

export function getPackages(creatorId: string, onlyActive = true) {
  return all<Pkg>(`SELECT * FROM packages WHERE creator_id = ? ${onlyActive ? 'AND active = 1' : ''} ORDER BY position, price`, creatorId);
}

export function getPackage(id: string) {
  return get<Pkg>('SELECT * FROM packages WHERE id = ?', id);
}

export type Review = { id: string; rating: number; body: string; created_at: number; buyer: string; game_name: string };
export function getReviews(creatorId: string, limit = 20) {
  return all<Review>(
    `SELECT r.id, r.rating, r.body, r.created_at, u.username AS buyer, o.game_name
       FROM reviews r JOIN users u ON u.id = r.buyer_id JOIN orders o ON o.id = r.order_id
      WHERE r.creator_id = ? ORDER BY r.created_at DESC LIMIT ?`,
    creatorId, limit,
  );
}

export async function uniqueSlug(base: string, ignoreCreatorId?: string) {
  const root = slugify(base);
  let slug = root;
  let i = 1;
  while (await get('SELECT 1 AS x FROM creators WHERE lower(slug) = lower(?) AND id != ?', slug, ignoreCreatorId ?? '')) {
    slug = `${root.slice(0, 28)}-${++i}`;
  }
  return slug;
}

/* ------------------------------------------------------ linking & verifying */

const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Creator';

const CLAIMED = 'This channel is already linked to another CreatorLink account. If it’s really yours, contact support and we’ll sort it out.';

/** Recompute the headline numbers shown on cards from the per-platform stats of VERIFIED platforms only. */
async function syncAggregates(creatorId: string) {
  const c = await get<Creator>('SELECT * FROM creators WHERE id = ?', creatorId);
  if (!c) return;
  const yt = !!c.youtube_verified_at;
  const tt = !!c.tiktok_verified_at;
  const followers = (yt ? c.youtube_subs ?? 0 : 0) + (tt ? c.tiktok_followers ?? 0 : 0);
  const avgs = [yt ? c.youtube_avg_views : null, tt ? c.tiktok_avg_views : null].filter((n): n is number => typeof n === 'number');
  const avg = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : 0;
  const platform = yt && tt ? 'both' : tt ? 'tiktok' : yt ? 'youtube' : c.youtube_channel_id && c.tiktok_handle ? 'both' : c.tiktok_handle ? 'tiktok' : 'youtube';
  await run('UPDATE creators SET followers = ?, avg_views = ?, platform = ? WHERE id = ?', followers, avg, platform, creatorId);
}

/** Save a looked-up channel against the user's creator profile (creating it on first link). Ownership is NOT proven yet. */
export async function linkChannel(userId: string, platform: 'youtube' | 'tiktok', info: YouTubeChannel | TikTokProfile | { manualRef: string; url: string }) {
  return tx(async () => {
    let c = await get<{ id: string; youtube_verified_at: number | null; tiktok_verified_at: number | null; status: string }>(
      'SELECT id, youtube_verified_at, tiktok_verified_at, status FROM creators WHERE user_id = ?', userId,
    );
    if (c?.status === 'suspended') throw new AppError('This creator account is suspended. Contact support.');
    if (c && (platform === 'youtube' ? c.youtube_verified_at : c.tiktok_verified_at)) {
      throw new AppError('This platform is already verified on your profile. Contact support if you need to change it.');
    }

    // A channel can belong to exactly one account. The unique indexes enforce this even under races.
    const manual = 'manualRef' in info ? info.manualRef.toLowerCase() : null;
    const ytId = platform === 'youtube' ? (manual ? `ref:${manual}` : (info as YouTubeChannel).id) : null;
    const ttHandle = platform === 'tiktok' ? (manual ?? (info as TikTokProfile).handle) : null;
    if (ytId && (await get('SELECT 1 AS x FROM creators WHERE youtube_channel_id = ? AND user_id != ?', ytId, userId))) throw new AppError(CLAIMED);
    if (ttHandle && (await get('SELECT 1 AS x FROM creators WHERE lower(tiktok_handle) = ? AND user_id != ?', ttHandle, userId))) throw new AppError(CLAIMED);

    const title = 'title' in info ? cleanName(info.title) : null;
    if (!c) {
      const id = uid();
      const name = title ?? cleanName(('manualRef' in info ? info.manualRef.split(':').pop()! : 'Creator').replace(/^@/, ''));
      await run(
        `INSERT INTO creators (id, user_id, slug, display_name, status, verification_code, created_at)
         VALUES (?,?,?,?,'pending',?,?)`,
        id, userId, await uniqueSlug(name), name, newChannelCode(), now(),
      );
      c = { id, youtube_verified_at: null, tiktok_verified_at: null, status: 'pending' };
    }
    if (platform === 'youtube') {
      const y = info as Partial<YouTubeChannel> & { url: string };
      await run(
        `UPDATE creators SET youtube_channel_id = ?, youtube_title = ?, youtube_thumb = ?, youtube_url = ?, youtube_subs = ?, youtube_total_views = ?,
                youtube_video_count = ?, youtube_avg_views = ?, youtube_synced_at = ? WHERE id = ?`,
        ytId, y.title ?? null, y.thumb ?? null, y.url, y.subs ?? null, y.totalViews ?? null, y.videoCount ?? null, y.avgViews ?? null, y.title ? now() : null, c.id,
      );
    } else {
      const t = info as Partial<TikTokProfile> & { url: string };
      await run(
        `UPDATE creators SET tiktok_handle = ?, tiktok_title = ?, tiktok_url = ?, tiktok_followers = ?, tiktok_likes = ?, tiktok_video_count = ?, tiktok_synced_at = ? WHERE id = ?`,
        ttHandle, t.title ?? null, t.url, t.followers ?? null, t.likes ?? null, t.videoCount ?? null, t.title ? now() : null, c.id,
      );
    }
    // Until something is verified the public name tracks the linked channel, so it can't be a made-up name.
    if (title && !c.youtube_verified_at && !c.tiktok_verified_at) {
      await run('UPDATE creators SET display_name = ?, slug = ? WHERE id = ?', title, await uniqueSlug(title, c.id), c.id);
    }
    await syncAggregates(c.id);
    return c.id;
  });
}

/** Mark a platform as ownership-verified (code found on the channel, or an admin checked by hand) and store fresh stats. */
export async function markVerified(creatorId: string, platform: 'youtube' | 'tiktok', info: YouTubeChannel | TikTokProfile | null, by: { adminId?: string } = {}) {
  return tx(async () => {
    const before = await get<{ user_id: string; display_name: string; status: string; youtube_verified_at: number | null; tiktok_verified_at: number | null }>(
      'SELECT user_id, display_name, status, youtube_verified_at, tiktok_verified_at FROM creators WHERE id = ?', creatorId,
    );
    if (!before) throw new AppError('Creator not found.');
    const t = now();
    if (platform === 'youtube') {
      const y = info as YouTubeChannel | null;
      await run(
        `UPDATE creators SET youtube_verified_at = ?, youtube_channel_id = COALESCE(?, youtube_channel_id), youtube_title = COALESCE(?, youtube_title),
                youtube_thumb = COALESCE(?, youtube_thumb), youtube_subs = COALESCE(?, youtube_subs), youtube_total_views = COALESCE(?, youtube_total_views),
                youtube_video_count = COALESCE(?, youtube_video_count), youtube_avg_views = COALESCE(?, youtube_avg_views), youtube_synced_at = COALESCE(?, youtube_synced_at) WHERE id = ?`,
        t, y?.id ?? null, y?.title ?? null, y?.thumb ?? null, y?.subs ?? null, y?.totalViews ?? null, y?.videoCount ?? null, y?.avgViews ?? null, y ? t : null, creatorId,
      );
    } else {
      const k = info as TikTokProfile | null;
      await run(
        `UPDATE creators SET tiktok_verified_at = ?, tiktok_title = COALESCE(?, tiktok_title), tiktok_followers = COALESCE(?, tiktok_followers),
                tiktok_likes = COALESCE(?, tiktok_likes), tiktok_video_count = COALESCE(?, tiktok_video_count), tiktok_synced_at = COALESCE(?, tiktok_synced_at) WHERE id = ?`,
        t, k?.title ?? null, k?.followers ?? null, k?.likes ?? null, k?.videoCount ?? null, k ? t : null, creatorId,
      );
    }
    await syncAggregates(creatorId);

    // First verification: run impersonation checks and either queue for review or auto-approve.
    if (!before.youtube_verified_at && !before.tiktok_verified_at) {
      const name = info && 'title' in info ? cleanName(info.title) : before.display_name;
      if (info && 'title' in info && name !== before.display_name) {
        await run('UPDATE creators SET display_name = ?, slug = ? WHERE id = ?', name, await uniqueSlug(name, creatorId), creatorId);
      }
      const flags = [...nameFlags(name)];
      const similar = await similarCreators(name, creatorId);
      if (similar.length) flags.push(`Name looks like an existing creator: ${similar.join(', ')}`);
      if (by.adminId) flags.push('Verified manually by an admin');
      await run('UPDATE creators SET review_flags = ? WHERE id = ?', JSON.stringify(flags), creatorId);
      if (config.autoApproveVerifiedCreators && !flags.length && before.status === 'pending') {
        await run("UPDATE creators SET status = 'approved', approved_at = ? WHERE id = ?", t, creatorId);
        await notify(before.user_id, 'You’re approved', 'Your verified channel is live in the marketplace once you add a package.', '/app/creator');
      } else {
        await notifyAdmins('Creator ready for review', `${name} verified their channel`, '/admin/creators');
      }
    }
    if (by.adminId) await audit(by.adminId, `creator.verify.${platform}`, creatorId);
  });
}

/** Refresh stats for an already-verified platform. */
export async function updateStats(creatorId: string, platform: 'youtube' | 'tiktok', info: YouTubeChannel | TikTokProfile) {
  if (platform === 'youtube') {
    const y = info as YouTubeChannel;
    await run('UPDATE creators SET youtube_title = ?, youtube_thumb = ?, youtube_subs = ?, youtube_total_views = ?, youtube_video_count = ?, youtube_avg_views = ?, youtube_synced_at = ? WHERE id = ?',
      y.title, y.thumb, y.subs, y.totalViews, y.videoCount, y.avgViews, now(), creatorId);
  } else {
    const k = info as TikTokProfile;
    await run('UPDATE creators SET tiktok_title = ?, tiktok_followers = ?, tiktok_likes = ?, tiktok_video_count = ?, tiktok_synced_at = ? WHERE id = ?',
      k.title, k.followers, k.likes, k.videoCount, now(), creatorId);
  }
  await syncAggregates(creatorId);
}

/** Headline, bio and genres. The public name and audience numbers come from the verified channel, not from the form. */
export async function saveCreatorDetails(userId: string, d: { headline: string; bio: string; niches: string[] }) {
  const r = await run('UPDATE creators SET headline = ?, bio = ?, niches = ? WHERE user_id = ?', d.headline, d.bio, JSON.stringify(d.niches), userId);
  if (!r.changes) throw new AppError('Link your channel first.');
}

export async function reviewCreator(adminId: string, creatorId: string, decision: 'approve' | 'reject' | 'suspend' | 'reinstate', note: string) {
  return tx(async () => {
    const c = await get<{ user_id: string; slug: string; display_name: string; status: string; youtube_verified_at: number | null; tiktok_verified_at: number | null }>(
      'SELECT user_id, slug, display_name, status, youtube_verified_at, tiktok_verified_at FROM creators WHERE id = ?', creatorId,
    );
    if (!c) throw new AppError('Creator not found.');
    if ((decision === 'approve' || decision === 'reinstate') && !c.youtube_verified_at && !c.tiktok_verified_at) {
      throw new AppError('Channel ownership isn’t verified yet. Use “Verify manually” after checking the code on their channel, or wait for them to verify.');
    }
    const status = decision === 'approve' || decision === 'reinstate' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended';
    await run('UPDATE creators SET status = ?, review_note = ?, approved_at = COALESCE(approved_at, ?) WHERE id = ?', status, note || null, status === 'approved' ? now() : null, creatorId);
    await audit(adminId, `creator.${decision}`, creatorId, { note });
    const msg: Record<string, [string, string]> = {
      approve: ['You’re approved', 'Your creator profile is live once you have at least one package.'],
      reinstate: ['Creator account reinstated', 'Your listing is live again.'],
      reject: ['Application not approved', note || 'Update your profile and re-apply.'],
      suspend: ['Creator account suspended', note || 'Contact support for details.'],
    };
    await notify(c.user_id, msg[decision][0], msg[decision][1], status === 'approved' ? `/creators/${c.slug}` : '/app/creator');
  });
}

/* ------------------------------------------------------------ packages CRUD */

export type PackageInput = { title: string; description: string; price: number; currency: Currency; deliveryDays: number; revisions: number };

export function savePackage(creatorId: string, id: string | null, p: PackageInput) {
  return tx(async () => {
    if (p.price < MIN_PRICE[p.currency]) throw new AppError(p.currency === 'USD' ? 'Minimum price is $3.' : 'Minimum price is R$ 50.');
    if (id) {
      const r = await run(
        'UPDATE packages SET title=?, description=?, price=?, currency=?, delivery_days=?, revisions=? WHERE id=? AND creator_id=?',
        p.title, p.description, p.price, p.currency, p.deliveryDays, p.revisions, id, creatorId,
      );
      if (!r.changes) throw new AppError('Package not found.');
      return;
    }
    const count = (await get<{ n: number }>('SELECT COUNT(*) AS n FROM packages WHERE creator_id = ? AND active = 1', creatorId))!.n;
    if (count >= 6) throw new AppError('You can have up to 6 active packages.');
    await run(
      'INSERT INTO packages (id,creator_id,title,description,price,currency,delivery_days,revisions,position,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      uid(), creatorId, p.title, p.description, p.price, p.currency, p.deliveryDays, p.revisions, count, now(),
    );
  });
}

export function archivePackage(creatorId: string, id: string) {
  return run('UPDATE packages SET active = 0 WHERE id = ? AND creator_id = ?', id, creatorId);
}
