# Deploy with Supabase (database + file storage) and Vercel

Supabase gives you the production Postgres database and private file storage. The app does **not** use Supabase Auth
or its client libraries; it connects to Postgres directly and creates its own tables.

Time: about 20 minutes. Cost: free tiers are enough to launch.

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Pick an organization, name it `creatorlink`, choose the region closest to your users, and set a strong **database
   password**. Save the password somewhere safe; you'll need it in step 2.
3. Wait for the project to finish provisioning (about a minute).

## 2. Get the database connection string

1. In your project, click **Connect** (top bar).
2. Open the **Connection string** tab and choose **Transaction pooler** (port **6543**).
3. Copy the URI. It looks like:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
4. Replace `[YOUR-PASSWORD]` with your database password. This is your `DATABASE_URL`.

> Use the **pooler** on Vercel/serverless: the direct connection (port 5432) is IPv6-only on new projects and will
> exhaust connections. If your password contains special characters (`@ : / ? #`), URL-encode them.

You don't need to create any tables. On first start the app applies `supabase/schema.sql` (via its built-in
migration runner) and enables **Row Level Security with no policies** on every table, so Supabase's public REST API can
never read your data. To do it yourself instead, paste `supabase/schema.sql` into **SQL Editor** and run it.

## 3. Create the private storage bucket

1. **Storage** > **New bucket**.
2. Name: `uploads`. Leave **Public bucket OFF**. Create.
3. Go to **Project Settings** > **API** (or **API Keys**) and copy:
   - **Project URL** (`https://abcdefgh.supabase.co`) -> `SUPABASE_URL`
   - the **service_role** secret key -> `SUPABASE_SERVICE_ROLE_KEY`

> The service_role key bypasses all security. Only ever put it in server environment variables. Never prefix it with
> `NEXT_PUBLIC_`, never commit it. Uploaded files are streamed through the app after a permission check; the bucket
> is never public.

## 4. (Optional) Email for password resets

1. Create a free account at <https://resend.com>, add and verify your domain, create an API key.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `CreatorLink <no-reply@yourdomain.com>`).

Without these, reset links are only printed to the server log, so users can't reset passwords. Set this before launch.

## 5. Deploy on Vercel

1. Push this repo to GitHub. In <https://vercel.com/new>, import it (framework: Next.js, nothing to change).
2. Add these **Environment Variables** (Production):

| Name | Value |
|---|---|
| `APP_URL` | `https://yourdomain.com` (your final URL, no trailing slash) |
| `DATABASE_URL` | the pooler URI from step 2 |
| `SUPABASE_URL` | from step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 3 |
| `SUPABASE_BUCKET` | `uploads` |
| `RESEND_API_KEY`, `EMAIL_FROM` | from step 4 |
| `CRON_SECRET` | a random string: `openssl rand -hex 32` |
| `DEPOSIT_GAMEPASS_URL` | your Roblox deposit gamepass link |
| `SUPPORT_EMAIL` | your support address |
| `FIRST_USER_IS_ADMIN` | `true` (temporarily, see step 6) |

   Do **not** set `ENABLE_TEST_FUNDS`.
3. Click **Deploy**. Open `https://<your-app>.vercel.app/api/health`. It should return `{"ok":true}`. That means the
   database connection works and the tables were created (check **Table Editor** in Supabase to see them).
4. Add your custom domain under **Settings** > **Domains**, and update `APP_URL` to match, then redeploy.

## 6. Create your admin account

1. Visit your site and sign up with *your* email. Because `FIRST_USER_IS_ADMIN=true`, the first account is an admin.
2. In Vercel, delete `FIRST_USER_IS_ADMIN` (or set it to `false`) and redeploy.
3. Log in and open `/admin`.

(Alternative, from your own machine: `DATABASE_URL=... npm run make-admin -- you@example.com`.)

## 7. Scheduled jobs

`vercel.json` calls `/api/cron/sweep` daily (the most the Vercel Hobby plan allows). It refunds orders creators
never answered and auto-releases deliveries nobody reviewed. The same checks also run opportunistically whenever
someone uses the app, so a quiet daily cron is fine early on. For tighter timing, upgrade the schedule on Vercel Pro,
or have any external pinger (for example cron-job.org) call every 10 minutes:

```
GET https://yourdomain.com/api/cron/sweep
Authorization: Bearer <CRON_SECRET>
```

## 8. Go-live checklist

- [ ] `/api/health` returns ok; Supabase Table Editor shows the tables with **RLS enabled**
- [ ] Storage bucket `uploads` is **private**
- [ ] Sign-up, log in, order, chat attachment and password-reset email all work on the production URL
- [ ] `ENABLE_TEST_FUNDS` is unset and `FIRST_USER_IS_ADMIN` is removed
- [ ] Terms and Privacy reviewed by a lawyer; `SUPPORT_EMAIL` is a real inbox you read
- [ ] You've read [How escrow and money work](HOW_IT_WORKS.md) and know how you'll confirm deposits and withdrawals
- [ ] Backups: Supabase Pro has daily backups; on the free plan, schedule `pg_dump "$DATABASE_URL" > backup.sql` somewhere safe
- [ ] Uptime monitor on `/api/health`

## Troubleshooting

| Symptom | Fix |
|---|---|
| `password authentication failed` | Wrong password in `DATABASE_URL`, or special characters not URL-encoded |
| `Tenant or user not found` | The pooler username must be `postgres.<project-ref>`, not just `postgres` |
| `ENOTFOUND` / `ENETUNREACH` | You used the direct (5432) host from an IPv4-only host. Use the pooler URI |
| `self-signed certificate` | Leave `DATABASE_SSL` unset (default `require`). For full verification set `DATABASE_SSL=verify` and `DATABASE_CA` to Supabase's CA certificate |
| Uploads fail with "Upload failed" | Check bucket name matches `SUPABASE_BUCKET` and the service_role key is correct (server logs show Supabase's response) |
| Uploads over ~4 MB fail | Vercel limits request bodies to 4.5 MB; the app caps uploads at 4 MB |
| No reset emails | `RESEND_API_KEY`/`EMAIL_FROM` missing, or sender domain not verified in Resend |

## Not on Vercel?

Any host that runs Node 22 works: set the same variables and run `npm ci && npm run build && npm start`, or use the
included `Dockerfile`. The database and storage stay on Supabase either way.
