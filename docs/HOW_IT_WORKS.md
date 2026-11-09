# How escrow and money work

This is the plain-English version of what the code does, what it doesn't do, and what you must run as the operator.

## Two currencies

Every package is priced in **Robux** or **USD** (stored as cents). Each user has two wallets, and an order is escrowed, refunded
and paid out in the currency it was priced in. There is no conversion between them.

- **USD is automatic end to end.** Deposits: Stripe Checkout, credited by a signed webhook. Payouts: a Stripe Connect transfer.
  Real dollars sit in your Stripe balance. See [PAYMENTS_AND_VERIFICATION.md](PAYMENTS_AND_VERIFICATION.md).
- **Robux is manual** (gamepass purchases confirmed by an admin), because Roblox offers no API for moving Robux.

## The short version

CreatorLink holds a **ledger**. Each user has a Robux balance in the database. When a developer orders, the price is
deducted from their balance and locked to the order. It is released to the creator (minus the fee), or refunded, by
strict rules. No user, and no bug in a single request, can move that money any other way.

What the software does **not** do is move real Robux. Roblox has no public API for that. Real Robux enters and leaves
through Roblox **gamepasses**, and an admin confirms each one by hand. So this is a **custodial** model: your
Roblox account holds the real Robux and your Stripe account holds the real dollars; the database says who is owed what.

## The order lifecycle

```
              place order                accept              deliver             approve
 (buyer) ───────────────▶ pending ───────────────▶ active ───────────────▶ delivered ──────────▶ completed
           price held       │  ▲                      │  ▲                      │                 creator +90%
           in escrow        │  └─ revision ───────────┘  └──────────────────────┤                 platform 10%
                            │                                                    │
                  decline / 48h no reply                    dispute (either side)│ 72h no action
                  / buyer cancels                                    │           └─▶ auto-release to creator
                            ▼                                        ▼
                   cancelled / declined                          disputed ──admin──▶ completed (release)
                   (full refund)                                                └──▶ refunded
```

| Event | What happens to the money |
|---|---|
| Buyer places order | `price` leaves buyer's balance, recorded as `escrow_hold` |
| Creator declines, doesn't respond in 48h, or buyer cancels early | Full `escrow_refund` to buyer |
| Creator misses the deadline | Buyer can cancel for a full refund |
| Buyer approves (or 72h review window passes) | Creator gets `price - fee` (`sale`), platform keeps `fee` |
| Dispute | Funds stay locked until an admin chooses release or refund; the decision is audit-logged |

## Why it can't double-pay

All money goes through one function, `postEntry` in `src/lib/ledger.ts`, and:

- Balance changes are one atomic SQL statement with a `CHECK (balance >= 0)` constraint, so overspending is impossible even
  with simultaneous requests.
- Every state change is a compare-and-swap (`UPDATE ... WHERE status = <expected>`), so double-clicks, two tabs or a
  retry can only succeed once. The status is flipped *before* money moves, inside one database transaction.
- Everything is in `tests/orders.test.ts` (17 tests against a real Postgres engine), including races: three simultaneous
  approvals pay once; two simultaneous orders can't spend one balance twice.
- The ledger is append-only and each row stores the resulting balance, so you can audit any account.

## Real Robux: what you operate

**Deposits** (user adds Robux)
1. User buys your deposit gamepass on Roblox for N Robux, then submits N + a reference in Wallet.
2. In Roblox's creator dashboard, confirm the purchase happened (the sales/transactions page for that gamepass).
3. Admin > Payments > **Mark done**. The user's balance is credited.

**Withdrawals** (creator cashes out)
1. Creator submits an amount and a gamepass link they created. The amount is deducted immediately and held.
2. You buy their gamepass from the platform's Roblox account.
3. Admin > Payments > **Mark done** (or **Reject** to refund the held amount).

Roblox takes its own marketplace cut on gamepass sales. Price deposit gamepasses so users aren't surprised, and make sure
your fee covers what Roblox takes on the way out.

## Reconciliation (do this regularly)

The Admin overview shows `User balances` and `Currently in escrow`. Together they are what you owe users. That number
should be **less than or equal to** the Robux actually held by the platform's Roblox account. If it isn't, stop and investigate.

## Risks to understand before launching

- You hold other people's money. Depending on where you operate, this can have legal/regulatory implications. Get advice.
- Roblox's rules around selling or transferring Robux and around off-platform payments can change. Read them.
- Manual confirmation doesn't scale and is a social-engineering target. Keep the admin role to a few trusted people with
  strong passwords, and consider adding 2FA (not included) before handling large amounts.
- Many users are minors. Moderate chat, keep the terms and privacy policy reviewed, and respond to reports quickly.
