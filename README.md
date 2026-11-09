# CreatorLink

A marketplace where Roblox developers hire YouTube and TikTok creators for fixed-price game promotions, with every Robux held in escrow until the work is approved.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind · Postgres (Supabase in production, embedded Postgres locally) · Zod · Vitest.

## Run it locally

Needs Node 22.13 or newer.

```bash
npm install
npm run local
```

That creates `.env.local`, loads fictional demo data and starts http://localhost:3000. No database setup: locally the app
uses an embedded Postgres (PGlite) stored in `./data`. Demo logins (password `demo1234`):
`dev@creatorlink.local` (developer), `kai.plays@creatorlink.local` (creator), `admin@creatorlink.local` (admin).

```bash
npm test            # escrow, wallet, ledger and race-condition tests
npm run typecheck
npm run build && npm start
```

## Going to production

Follow **[docs/SUPABASE.md](docs/SUPABASE.md)**: Supabase for the database and file storage, Vercel (or any Node host) for the app.
Read **[docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md)** before launch. It explains exactly how escrow works, what is manual,
and what you need to run as the operator.

All configuration is in `.env.example`.

## What's in it

- **Marketplace:** search, filter and sort creators; public profiles with packages and reviews from completed orders.
- **Escrow orders:** place, accept, deliver, approve, with revisions and disputes. Declined, unanswered (48h) and late orders refund
  automatically; unreviewed deliveries auto-release after 72h.
- **Wallet and ledger:** whole-Robux balances, an append-only ledger, deposits and withdrawals via Roblox gamepasses confirmed by an admin.
- **Order chat** with image and video attachments, served only to the two parties on the order.
- **Accounts:** sign-up, login, password reset by email, profile and avatar, notifications.
- **Creators:** application, admin approval, packages, pause/resume listing.
- **Admin (`/admin`):** applications, dispute resolution, payment requests, user suspension and balance adjustments, all audit-logged.
- **Ops:** `/api/health`, `/api/cron/sweep`, rate limiting on auth and money actions, security headers, CI workflow, Dockerfile.

## Project layout

```
src/lib/ledger.ts     postEntry(): the only code that changes a balance
src/lib/orders.ts     escrow state machine
src/lib/wallet.ts     deposits, withdrawals, gamepass parsing
src/lib/db.ts         Postgres access (pg in production, PGlite locally) + migrations runner
src/lib/schema.ts     the schema (exported to supabase/schema.sql by `npm run schema`)
src/lib/storage.ts    uploads: private Supabase Storage bucket, or local disk in dev
src/app/actions/      server actions (validation, auth, rate limits)
tests/                escrow lifecycle, ledger integrity and race tests
```

## Scripts

| Command | What it does |
|---|---|
| `npm run local` | One-command local start (env file + demo data + dev server) |
| `npm run seed -- --reset` | Reload demo data (local only; refuses to run against `DATABASE_URL`) |
| `npm run migrate` | Apply pending migrations to the configured database |
| `npm run make-admin -- you@example.com` | Promote a user to admin |
| `npm run schema` | Regenerate `supabase/schema.sql` |
