import { all, get, run, tx, now, uid } from './db';
import { AppError, audit, notify } from './ledger';
import { slugify } from './validators';

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
  is_listed: number;
  completed_orders: number;
  rating_sum: number;
  rating_count: number;
  created_at: number;
  username: string;
  avatar: string | null;
  min_price: number | null;
};

export type Pkg = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  price: number;
  delivery_days: number;
  revisions: number;
  active: number;
  position: number;
};

type Raw = Omit<Creator, 'niches'> & { niches: string };
const parse = (r: Raw): Creator => ({ ...r, niches: safeJson(r.niches) });
function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const SELECT = `
  SELECT c.*, u.username, u.avatar,
         (SELECT MIN(price) FROM packages p WHERE p.creator_id = c.id AND p.active = 1) AS min_price
    FROM creators c JOIN users u ON u.id = c.user_id`;

export type Filters = {
  q?: string;
  platform?: 'youtube' | 'tiktok';
  niche?: string;
  maxPrice?: number;
  sort?: 'popular' | 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'audience';
  page?: number;
  perPage?: number;
};

export function listCreators(f: Filters = {}) {
  const where = ["c.status = 'approved'", 'c.is_listed = 1', 'EXISTS (SELECT 1 FROM packages p WHERE p.creator_id = c.id AND p.active = 1)'];
  const args: (string | number)[] = [];
  if (f.q) {
    where.push('(c.display_name LIKE ? OR c.headline LIKE ? OR c.bio LIKE ? OR c.niches LIKE ?)');
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
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
  if (f.maxPrice) {
    where.push('(SELECT MIN(price) FROM packages p WHERE p.creator_id = c.id AND p.active = 1) <= ?');
    args.push(f.maxPrice);
  }
  const order =
    {
      popular: 'c.completed_orders DESC, c.rating_count DESC',
      rating: '(CASE WHEN c.rating_count = 0 THEN 0 ELSE 1.0 * c.rating_sum / c.rating_count END) DESC, c.rating_count DESC',
      price_asc: 'min_price ASC',
      price_desc: 'min_price DESC',
      newest: 'c.approved_at DESC',
      audience: 'c.followers DESC',
    }[f.sort ?? 'popular'] + ', c.created_at DESC';
  const perPage = f.perPage ?? 12;
  const page = Math.max(1, f.page ?? 1);
  const total = get<{ n: number }>(`SELECT COUNT(*) n FROM creators c WHERE ${where.join(' AND ')}`, ...args)!.n;
  const rows = all<Raw>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, perPage, (page - 1) * perPage);
  return { creators: rows.map(parse), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export function featuredCreators(n = 4) {
  return listCreators({ sort: 'popular', perPage: n }).creators;
}

export function getCreatorBySlug(slug: string) {
  const r = get<Raw>(`${SELECT} WHERE c.slug = ?`, slug);
  return r ? parse(r) : undefined;
}

export function getCreatorByUser(userId: string) {
  const r = get<Raw>(`${SELECT} WHERE c.user_id = ?`, userId);
  return r ? parse(r) : undefined;
}

export function getPackages(creatorId: string, onlyActive = true) {
  return all<Pkg>(
    `SELECT * FROM packages WHERE creator_id = ? ${onlyActive ? 'AND active = 1' : ''} ORDER BY position, price`,
    creatorId,
  );
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

export function uniqueSlug(base: string, ignoreCreatorId?: string) {
  let slug = slugify(base);
  let i = 1;
  while (get('SELECT 1 FROM creators WHERE slug = ? AND id != ?', slug, ignoreCreatorId ?? '')) {
    slug = `${slugify(base).slice(0, 28)}-${++i}`;
  }
  return slug;
}

export type Application = {
  displayName: string; platform: 'youtube' | 'tiktok' | 'both'; youtubeUrl: string; tiktokUrl: string;
  followers: number; avgViews: number; headline: string; bio: string; niches: string[];
};

/** Create or update the creator profile. Applications start as `pending` and need admin approval. */
export function saveCreatorProfile(userId: string, a: Application) {
  return tx(() => {
    const existing = get<{ id: string; status: string }>('SELECT id, status FROM creators WHERE user_id = ?', userId);
    const yt = a.platform !== 'tiktok' ? a.youtubeUrl || null : null;
    const tt = a.platform !== 'youtube' ? a.tiktokUrl || null : null;
    if (existing) {
      if (existing.status === 'suspended') throw new AppError('This creator account is suspended. Contact support.');
      const statusReset = existing.status === 'rejected' ? ", status = 'pending', review_note = NULL" : '';
      run(
        `UPDATE creators SET display_name=?, headline=?, bio=?, platform=?, youtube_url=?, tiktok_url=?, followers=?, avg_views=?, niches=?${statusReset} WHERE id=?`,
        a.displayName, a.headline, a.bio, a.platform, yt, tt, a.followers, a.avgViews, JSON.stringify(a.niches), existing.id,
      );
      return { id: existing.id, created: false };
    }
    const id = uid();
    run(
      `INSERT INTO creators (id,user_id,slug,display_name,headline,bio,platform,youtube_url,tiktok_url,followers,avg_views,niches,status,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)`,
      id, userId, uniqueSlug(a.displayName), a.displayName, a.headline, a.bio, a.platform, yt, tt,
      a.followers, a.avgViews, JSON.stringify(a.niches), now(),
    );
    for (const adm of all<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")) {
      notify(adm.id, 'New creator application', a.displayName, '/admin/creators');
    }
    return { id, created: true };
  });
}

export function reviewCreator(adminId: string, creatorId: string, decision: 'approve' | 'reject' | 'suspend' | 'reinstate', note: string) {
  tx(() => {
    const c = get<{ user_id: string; slug: string; display_name: string; status: string }>('SELECT user_id, slug, display_name, status FROM creators WHERE id = ?', creatorId);
    if (!c) throw new AppError('Creator not found.');
    const status = decision === 'approve' || decision === 'reinstate' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended';
    run('UPDATE creators SET status = ?, review_note = ?, approved_at = COALESCE(approved_at, ?) WHERE id = ?', status, note || null, status === 'approved' ? now() : null, creatorId);
    audit(adminId, `creator.${decision}`, creatorId, { note });
    const msg: Record<string, [string, string]> = {
      approve: ['You’re approved', 'Your creator profile is live in the marketplace.'],
      reinstate: ['Creator account reinstated', 'Your listing is live again.'],
      reject: ['Application not approved', note || 'Update your profile and re-apply.'],
      suspend: ['Creator account suspended', note || 'Contact support for details.'],
    };
    notify(c.user_id, msg[decision][0], msg[decision][1], status === 'approved' ? `/creators/${c.slug}` : '/app/creator');
  });
}

/* ------------------------------------------------------------ packages CRUD */

export function savePackage(creatorId: string, id: string | null, p: { title: string; description: string; price: number; deliveryDays: number; revisions: number }) {
  tx(() => {
    if (id) {
      const r = run(
        'UPDATE packages SET title=?, description=?, price=?, delivery_days=?, revisions=? WHERE id=? AND creator_id=?',
        p.title, p.description, p.price, p.deliveryDays, p.revisions, id, creatorId,
      );
      if (!r.changes) throw new AppError('Package not found.');
      return;
    }
    const count = get<{ n: number }>('SELECT COUNT(*) n FROM packages WHERE creator_id = ? AND active = 1', creatorId)!.n;
    if (count >= 6) throw new AppError('You can have up to 6 active packages.');
    run(
      'INSERT INTO packages (id,creator_id,title,description,price,delivery_days,revisions,position,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      uid(), creatorId, p.title, p.description, p.price, p.deliveryDays, p.revisions, count, now(),
    );
  });
}

export function archivePackage(creatorId: string, id: string) {
  run('UPDATE packages SET active = 0 WHERE id = ? AND creator_id = ?', id, creatorId);
}
