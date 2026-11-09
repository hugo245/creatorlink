import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SQLite via Node's built-in driver (no native addons to compile).
 * One connection per process, WAL mode, versioned migrations.
 * `process.getBuiltinModule` keeps the bundler from trying to resolve the builtin.
 */

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    roblox_username TEXT,
    avatar TEXT,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    banned_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    user_agent TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE creators (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
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
    created_at INTEGER NOT NULL,
    approved_at INTEGER
  );
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
    created_at INTEGER NOT NULL
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
    respond_by INTEGER,
    due_at INTEGER,
    delivery_url TEXT,
    delivery_note TEXT,
    delivered_at INTEGER,
    auto_release_at INTEGER,
    dispute_reason TEXT,
    dispute_by TEXT,
    dispute_note TEXT,
    closed_reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
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
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_messages_order ON messages(order_id, created_at);

  CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    order_id TEXT REFERENCES orders(id),
    note TEXT,
    created_at INTEGER NOT NULL
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
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );
  CREATE INDEX idx_pay_status ON payment_requests(status, created_at);

  CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id TEXT NOT NULL REFERENCES users(id),
    creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_reviews_creator ON reviews(creator_id, created_at DESC);

  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    href TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_notif_user ON notifications(user_id, read_at, created_at DESC);

  CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    target TEXT,
    meta TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );
  `,
];

type G = typeof globalThis & { __db?: DatabaseSync };

function open(): DatabaseSync {
  const sqlite = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const file = process.env.DATABASE_FILE || path.join(DATA_DIR, 'creatorlink.db');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new sqlite.DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

export function getDb(): DatabaseSync {
  const g = globalThis as G;
  if (!g.__db) g.__db = open();
  return g.__db;
}

export const db = new Proxy({} as DatabaseSync, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

/** Run `fn` inside an immediate (write-locking) transaction. Nested calls join the outer one. */
let depth = 0;
export function tx<T>(fn: () => T): T {
  if (depth > 0) return fn();
  const d = getDb();
  d.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  } finally {
    depth--;
  }
}

type SqlValue = string | number | bigint | null | Uint8Array;
export function all<T = Record<string, unknown>>(sql: string, ...params: SqlValue[]): T[] {
  // node:sqlite returns null-prototype rows; copy to plain objects so they can cross the RSC boundary.
  return (getDb().prepare(sql) as StatementSync).all(...params).map((r) => ({ ...r })) as T[];
}
export function get<T = Record<string, unknown>>(sql: string, ...params: SqlValue[]): T | undefined {
  const r = (getDb().prepare(sql) as StatementSync).get(...params);
  return r ? ({ ...r } as T) : undefined;
}
export function run(sql: string, ...params: SqlValue[]) {
  return (getDb().prepare(sql) as StatementSync).run(...params);
}

export const now = () => Date.now();
export const uid = () => randomBytes(12).toString('base64url');
