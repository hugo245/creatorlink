# CreatorLink

A marketplace where Roblox developers hire YouTube and TikTok creators for fixed-price game promotions — with every Robux held in escrow until the work is approved.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind · SQLite (Node's built-in `node:sqlite`, no native modules) · Zod · Vitest.

## Run it locally

```bash
npm install
cp .env.example .env.local      # set ENABLE_TEST_FUNDS=true for instant fake funds in dev
npm run seed                    # fictional demo creators, orders and accounts (dev only)
npm run dev                     # http://localhost:3000
```

Demo logins (password `demo1234`): `dev@creatorlink.local` (developer), `kai.plays@creatorlink.local` (creator), `admin@creatorlink.local` (admin).

```bash
npm test          # escrow / wallet / ledger tests
npm run typecheck
npm run build && npm start
```

## What's in it

- **Marketplace** — search/filter/sort creators, public profiles with packages and verified reviews.
- **Escrow orders** — place → creator accepts → delivers → buyer approves (or requests a revision / opens a dispute). Declined, expired (48h) and late orders refund automatically; stale deliveries auto-release after 72h.
- **Wallet & ledger** — integer-Robux balance, append-only transaction ledger, deposits/withdrawals via Roblox gamepasses confirmed by an admin.
- **Order chat** with image/video attachments (magic-byte validated, served only to the two parties).
- **Notifications**, creator applications + approval, reviews, settings.
- **Admin** (`/admin`) — creator applications, dispute resolution, payment requests, user suspension and balance adjustments (all audit-logged).

## Production

1. Build and run the Docker image, mounting a persistent volume at `/data` (SQLite database + uploads):
   ```bash
   docker build -t creatorlink .
   docker run -p 3000:3000 -v creatorlink-data:/data -e APP_URL=https://yourdomain.com creatorlink
   ```
   Put it behind HTTPS (cookies are `Secure` when `APP_URL` is `https://`). Run **one instance** — SQLite is single-writer.
2. Create your admin: sign up, then `run `npm run make-admin -- you@example.com` against the same `DATA_DIR`` (or run once with `FIRST_USER_IS_ADMIN=true`).
3. Set `DEPOSIT_GAMEPASS_URL`, `SUPPORT_EMAIL`, `PLATFORM_FEE_BPS`. Leave `ENABLE_TEST_FUNDS` **off**.
4. Back up `/data` regularly (the SQLite file is in WAL mode — use `sqlite3 .backup` or a volume snapshot).

### Before you launch — things to decide
- **Legal:** `/terms` and `/privacy` are sensible starting drafts, not legal advice. Have them reviewed — especially around holding user balances and minors (many Roblox users are under 18).
- **Deposits/withdrawals are manual** (admin confirms gamepass purchases). There is no Roblox API integration for payments; automate this once you have a verified payout flow.
- **Email:** there is no transactional email yet (notifications are in-app). Password reset requires an email provider — the natural next feature.
- **Scale:** to go multi-instance, swap `src/lib/db.ts` for Postgres; all queries are plain SQL in `src/lib`.

## Layout

```
src/lib/orders.ts     escrow state machine (all money movement goes through ledger.ts)
src/lib/ledger.ts     postEntry(): the only code that changes a balance
src/lib/wallet.ts     deposits, withdrawals, gamepass parsing
src/app/actions/      server actions (validation, auth, rate limits)
tests/                escrow lifecycle + ledger-integrity tests
```
