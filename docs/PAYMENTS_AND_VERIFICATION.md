# USD payments (Stripe) and creator verification

Two features need outside accounts. Both are optional for local development, and required for a real launch.

---

## Part 1. USD payments with Stripe

### How the money flows

| Step | What happens |
|---|---|
| Developer adds funds | Stripe Checkout charges their card. A webhook credits their **USD wallet** exactly once. |
| Developer orders a USD package | The price is locked in **escrow** (a ledger hold, same as Robux). |
| Developer approves | Creator's USD wallet is credited (price minus your fee). The fee is yours. |
| Creator withdraws | A Stripe **Connect transfer** moves the money from your Stripe balance to the creator's connected account, and Stripe pays it out to their bank. |

Real USD sits in **your Stripe balance** the whole time. The database ledger says who is owed what, the same model as Robux.

### Setup (about 15 minutes, test mode first)

1. Create a Stripe account at <https://dashboard.stripe.com> and stay in **Test mode**.
2. **Developers > API keys**: copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY`.
3. **Connect**: open **Connect > Get started**, choose **Platform or marketplace**, and enable **Express** accounts. (Creators onboard through Stripe's hosted flow; Stripe does their identity checks and holds their bank details. You never see them.)
4. **Developers > Webhooks > Add endpoint**:
   - URL: `https://YOURDOMAIN/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.dispute.created`
   - Copy the **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
5. Redeploy. In **Wallet > US dollars > Add funds**, pay with test card `4242 4242 4242 4242` (any future date, any CVC). Your balance appears within seconds.
6. For local webhooks use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and put the `whsec_...` it prints in `.env.local`.
7. Test payouts: in test mode, Connect onboarding accepts Stripe's test data (the form offers "Use test data"). Then withdraw from a creator wallet.
8. **Going live**: complete Stripe's account activation, switch to live keys and a live webhook endpoint, and re-run steps 4 and 5 with a real $5 card.

> Transfers to creators come out of your **available** Stripe balance. Card payments settle in about 2 to 7 days, so a very fast payout may fail with "insufficient funds". The app keeps those requests **pending** and alerts admins (Admin > Payments); mark them done once sent, or reject to refund the user. Add a Stripe balance buffer or enable faster settlement if you expect heavy payouts.

### Fraud and chargeback protection built in

- **Payout hold**: sale earnings become withdrawable `USD_PAYOUT_HOLD_DAYS` (default 7) days after the sale, so a chargeback is more likely to arrive before the money leaves.
- **Chargeback response**: `charge.dispute.created` automatically pauses that user's payouts and alerts admins.
- **Account age**: new accounts can't withdraw for `MIN_ACCOUNT_AGE_DAYS_FOR_PAYOUT` days. Verified email is required to deposit or withdraw.
- **Card fees** are passed through to the depositor, so the credited amount is exact and you don't lose margin.
- **Idempotency**: Stripe retries webhooks; a unique index guarantees one credit per payment (tested).
- Admins can place a manual **payout hold** on any user (Admin > Users).

### What you're responsible for

Holding customer funds and paying people out can make you a **money transmitter** in some places. Stripe Connect covers identity and bank verification, but the legal classification is yours. Read Stripe's marketplace guidance and get advice before launch.

---

## Part 2. Creator verification

### The idea

Creators don't type their name or numbers. They paste their channel link; CreatorLink reads the channel from the platform, and the creator proves they own it by adding a one-time code (`CL-XXXXXXXX`) to the channel description (YouTube) or bio (TikTok). Only the real owner can edit those. The public name, avatar and stats then come from the platform, so nobody can pose as someone else or inflate numbers.

| Control | What it stops |
|---|---|
| Ownership code | Claiming someone else's channel |
| One channel, one account (unique index) | Two people claiming the same channel |
| Public name locked to the channel name | Made-up or misleading names |
| Stats fetched, never typed | Fake audience numbers |
| Name look-alike check against approved creators (`K4i_Plays` vs `Kai Plays`) | Copycat channels, flagged for the admin |
| Reserved/brand/abusive name blocklist | "CreatorLink Support", slurs |
| Username rules + look-alike uniqueness | Weird or confusable usernames |
| Verified email required | Throwaway accounts |
| Admin approval (only after verification) | Anything the automation misses |
| Report buttons + flagged chat | Scams that appear after approval |

### YouTube: automatic

1. Go to <https://console.cloud.google.com>, create a project, and enable **YouTube Data API v3**.
2. **Credentials > Create credentials > API key**. Restrict it to the YouTube Data API.
3. Set `YOUTUBE_API_KEY`. That's it.

Subscribers, total views and video count are exact. **Average views** is the mean of the creator's last 10 uploads (ignoring the newest few days). Numbers refresh daily via the cron job and on demand (limited to twice an hour per creator). Quota use is about 3 units per refresh against a 10,000 per day default.

Supported links: `youtube.com/@handle` and `youtube.com/channel/UC...`. (Old `/c/name` links can't be resolved without an expensive search call, so creators are asked to use their handle.)

Without a key, creators can still link a channel, but it stays unverified until an admin checks the code by eye and presses **Verify manually**.

### TikTok: best effort

TikTok offers no public stats API for sites like this without per-user OAuth approval from TikTok. CreatorLink reads the public profile page. If TikTok serves it, followers, likes and video count are filled in and the bio code is checked automatically. If TikTok blocks the request (common from data-centre IPs), the creator is told, and an admin verifies the bio code by hand. TikTok **average views** isn't available this way, so it isn't shown. For guaranteed TikTok numbers, apply for TikTok's Login Kit / Display API and swap `fetchTikTok` in `src/lib/channels.ts`.

### Reviewing a creator (admin)

Admin > Creators shows each application with ownership status, linked channels, account age, email status, **flags** (name similar to an existing creator, reserved words, manually verified) and the code. Approve only when verified; the app refuses to approve an unverified creator. To approve verified, unflagged creators automatically, set `AUTO_APPROVE_VERIFIED_CREATORS=true` once you trust the pipeline.
