import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS } from './schema';

/**
 * One SQL dialect (Postgres), two engines:
 *  - DATABASE_URL set  -> `pg` against your Postgres (Supabase in production)
 *  - otherwise         -> PGlite, a real Postgres compiled to WASM, stored under DATA_DIR/pgdata (local dev, tests)
 * Queries are written with `?` placeholders and converted to `$n` here.
 */

type Result = { rows: Record<string, unknown>[]; changes: number };
type Runner = { query(sql: string, params: unknown[]): Promise<Result> };
type Backend = Runner & { transaction<T>(fn: (r: Runner) => Promise<T>): Promise<T> };

const toPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};
const num = (v: string) => Number(v);

async function openPg(url: string): Promise<Backend> {
  const pg = await import('pg');
  pg.types.setTypeParser(20, num); // int8 (COUNT, BIGINT) -> number
  pg.types.setTypeParser(1700, num); // numeric (SUM of ints, averages) -> number
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  const sslMode = process.env.DATABASE_SSL ?? (local ? 'disable' : 'require');
  u.searchParams.delete('sslmode');
  const pool = new pg.Pool({
    connectionString: u.toString(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 20_000,
    // Supabase's pooler presents a certificate chain Node doesn't trust by default. `require` encrypts the
    // connection; set DATABASE_SSL=verify and DATABASE_CA to also verify the server certificate.
    ssl: sslMode === 'disable' ? false : sslMode === 'verify' ? { ca: process.env.DATABASE_CA } : { rejectUnauthorized: false },
  });
  const wrap = (c: { query: (s: string, p: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }): Runner => ({
    async query(sql, params) {
      const r = await c.query(toPg(sql), params);
      return { rows: r.rows, changes: r.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool as never),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client as never));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function openPglite(): Promise<Backend> {
  const { PGlite } = await import('@electric-sql/pglite');
  const file = process.env.DATABASE_FILE;
  const dir = file === ':memory:' ? undefined : file || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'pgdata');
  if (dir) fs.mkdirSync(path.dirname(dir), { recursive: true });
  const lite = new PGlite(dir, { parsers: { 20: num, 1700: num } });
  await lite.waitReady;
  const wrap = (c: { query: (s: string, p: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }): Runner => ({
    async query(sql, params) {
      const r = await c.query(toPg(sql), params);
      return { rows: r.rows as Record<string, unknown>[], changes: r.affectedRows ?? 0 };
    },
  });
  return {
    ...wrap(lite as never),
    transaction: (fn) => lite.transaction((t) => fn(wrap(t as never))),
  };
}

async function migrate(b: Backend) {
  await b.transaction(async (r) => {
    await r.query('SELECT pg_advisory_xact_lock(727274)', []); // serialise concurrent cold starts
    await r.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)', []);
    await r.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY', []);
    const done = new Set((await r.query('SELECT version FROM schema_migrations', [])).rows.map((x) => Number(x.version)));
    for (let i = 0; i < MIGRATIONS.length; i++) {
      if (done.has(i + 1)) continue;
      for (const stmt of MIGRATIONS[i].split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await r.query(stmt, []);
      await r.query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [i + 1, Date.now()]);
    }
  });
}

type G = typeof globalThis & { __dbp?: Promise<Backend> };
function backend(): Promise<Backend> {
  const g = globalThis as G;
  if (!g.__dbp) {
    g.__dbp = (async () => {
      const b = process.env.DATABASE_URL ? await openPg(process.env.DATABASE_URL) : await openPglite();
      await migrate(b);
      return b;
    })();
    g.__dbp.catch(() => { g.__dbp = undefined; });
  }
  return g.__dbp;
}

const als = new AsyncLocalStorage<Runner>();
const runner = async (): Promise<Runner> => als.getStore() ?? (await backend());

type Param = string | number | null;

export async function all<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await (await runner()).query(sql, params)).rows as T[];
}
export async function get<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await all<T>(sql, ...params))[0];
}
export async function run(sql: string, ...params: Param[]): Promise<{ changes: number }> {
  const r = await (await runner()).query(sql, params);
  return { changes: r.changes };
}

/** Run `fn` in one database transaction. Nested calls join the outer transaction. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (als.getStore()) return fn();
  const b = await backend();
  return b.transaction((r) => als.run(r, fn));
}

export async function closeDb() {
  const g = globalThis as G;
  g.__dbp = undefined;
}

export const now = () => Date.now();

let seq = 0;
/** Time-ordered unique id: sorts by creation time, so `ORDER BY created_at, id` is a stable tiebreak. */
export function uid() {
  seq = (seq + 1) % 1296;
  return Date.now().toString(36).padStart(9, '0') + seq.toString(36).padStart(2, '0') + randomBytes(7).toString('base64url');
}
