/**
 * Postgres schema, applied automatically on first connection (see db.ts).
 * The same SQL is exported to supabase/schema.sql by `npm run schema` for people who prefer the SQL editor.
 *
 * Money is whole Robux (INTEGER). Timestamps are epoch milliseconds (BIGINT).
 * Row Level Security is enabled on every table with NO policies: Supabase exposes the `public` schema through
 * its REST API, and this app never uses that API, so the anon/authenticated roles must see nothing.
 * The server connects with the database owner role, which bypasses RLS.
 */
const TABLES = [
  'users', 'sessions', 'creators', 'packages', 'orders', 'messages', 'transactions',
  'payment_requests', 'reviews', 'notifications', 'audit_log', 'rate_limits', 'password_resets',
];

export const MIGRATIONS: string[] = [
  /* 1: initial schema */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    roblox_username TEXT,
    avatar TEXT,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    banned_at BIGINT,
    created_at BIGINT NOT NULL
  );
  CREATE UNIQUE INDEX users_email_key ON users (lower(email));
  CREATE UNIQUE INDEX users_username_key ON users (lower(username));

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    user_agent TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE creators (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    display_name TEXT NOT NULL,
    headline TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL DEFAULT 'youtube' CHECK (platform IN ('youtube','tiktok','both')),
    youtube_url TEXT,
    tiktok_url TEXT,
    followers INTEGER NOT NULL DEFAULT 0,
    avg_views INTEGER NOT NULL DEFAULT 0,
    niches TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
    review_note TEXT,
    is_listed INTEGER NOT NULL DEFAULT 1,
    completed_orders INTEGER NOT NULL DEFAULT 0,
    rating_sum INTEGER NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    approved_at BIGINT
  );
  CREATE UNIQUE INDEX creators_slug_key ON creators (lower(slug));
  CREATE INDEX idx_creators_status ON creators(status, is_listed);

  CREATE TABLE packages (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 50),
    delivery_days INTEGER NOT NULL CHECK (delivery_days BETWEEN 1 AND 60),
    revisions INTEGER NOT NULL DEFAULT 1 CHECK (revisions BETWEEN 0 AND 10),
    active INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX idx_packages_creator ON packages(creator_id);

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL REFERENCES users(id),
    creator_id TEXT NOT NULL REFERENCES creators(id),
    seller_user_id TEXT NOT NULL REFERENCES users(id),
    package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
    package_title TEXT NOT NULL,
    price INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    delivery_days INTEGER NOT NULL,
    revisions_allowed INTEGER NOT NULL DEFAULT 1,
    revisions_used INTEGER NOT NULL DEFAULT 0,
    game_name TEXT NOT NULL,
    game_url TEXT NOT NULL,
    brief TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('pending','active','delivered','completed','disputed','cancelled','declined','refunded')),
    respond_by BIGINT,
    due_at BIGINT,
    delivery_url TEXT,
    delivery_note TEXT,
    delivered_at BIGINT,
    auto_release_at BIGINT,
    dispute_reason TEXT,
    dispute_by TEXT,
    dispute_note TEXT,
    closed_reason TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    completed_at BIGINT
  );
  CREATE INDEX idx_orders_buyer ON orders(buyer_id, created_at DESC);
  CREATE INDEX idx_orders_seller ON orders(seller_user_id, created_at DESC);
  CREATE INDEX idx_orders_status ON orders(status);

  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user','system')),
    body TEXT NOT NULL DEFAULT '',
    file_path TEXT,
    file_name TEXT,
    file_type TEXT,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX idx_messages_order ON messages(order_id, created_at, id);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    order_id TEXT REFERENCES orders(id),
    note TEXT,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX idx_tx_user ON transactions(user_id, created_at DESC);

  CREATE TABLE payment_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
    gamepass_url TEXT,
    reference TEXT,
    admin_note TEXT,
    created_at BIGINT NOT NULL,
    resolved_at BIGINT
  );
  CREATE INDEX idx_pay_status ON payment_requests(status, created_at);

  CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id TEXT NOT NULL REFERENCES users(id),
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL
  );
  CREATE INDEX idx_reviews_creator ON reviews(creator_id, created_at DESC);

  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    href TEXT,
    read_at BIGINT,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX idx_notif_user ON notifications(user_id, read_at, created_at DESC);

  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target TEXT,
    meta TEXT,
    created_at BIGINT NOT NULL
  );

  CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at BIGINT NOT NULL
  );

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    used_at BIGINT
  );

  ${TABLES.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`).join('\n  ')}
  `,
];
