import { all, get, run, tx, now, uid } from './db';
import { config, DAY } from './config';
import { AppError, audit, notify, notifyAdmins, postEntry } from './ledger';
import { fmtMoney, MIN_DEPOSIT, MIN_WITHDRAWAL, type Currency } from './money';
import { createTransfer } from './stripe';

export type PaymentRequest = {
  id: string;
  user_id: string;
  kind: 'deposit' | 'withdrawal';
  amount: number;
  currency: Currency;
  status: 'pending' | 'completed' | 'rejected';
  gamepass_url: string | null;
  reference: string | null;
  provider: string | null;
  provider_ref: string | null;
  admin_note: string | null;
  created_at: number;
  resolved_at: number | null;
};

/** Extract a gamepass id from a roblox.com URL (or a bare numeric id). */
export function parseGamepassId(input: string): string | null {
  const s = input.trim();
  if (/^\d{3,15}$/.test(s)) return s;
  const m = s.match(/^https?:\/\/(?:www\.)?roblox\.com\/(?:[a-z-]+\/)?game-pass\/(\d{3,15})(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

type Payer = { id: string; email_verified_at: number | null; payout_hold?: number; created_at?: number };

/** Dev-only instant top-up of both wallets. Guarded by ENABLE_TEST_FUNDS. */
export async function addTestFunds(userId: string) {
  if (!config.testFunds) throw new AppError('Test funds are disabled.');
  await tx(async () => {
    await postEntry(userId, 5000, 'test_deposit', { note: 'Test funds' });
    await postEntry(userId, 5000, 'test_deposit', { currency: 'USD', note: 'Test funds' });
  });
}

/* ----------------------------------------------------------- Robux (manual) */

export function requestDeposit(userId: string, amount: number, reference: string) {
  if (amount < MIN_DEPOSIT.ROBUX) throw new AppError(`Minimum deposit is R$ ${MIN_DEPOSIT.ROBUX}.`);
  return tx(async () => {
    const pending = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM payment_requests WHERE user_id = ? AND kind = 'deposit' AND status = 'pending' AND currency = 'ROBUX'", userId))!;
    if (pending.n >= 3) throw new AppError('You already have 3 deposits awaiting confirmation.');
    await run(
      "INSERT INTO payment_requests (id, user_id, kind, amount, currency, reference, created_at) VALUES (?,?,'deposit',?,'ROBUX',?,?)",
      uid(), userId, amount, reference, now(),
    );
    await notifyAdmins('Deposit awaiting confirmation', fmtMoney(amount, 'ROBUX'), '/admin/payments');
  });
}

/** Rules every withdrawal must pass, in either currency. */
export async function assertCanWithdraw(user: Payer & { created_at: number }) {
  if (!user.email_verified_at) throw new AppError('Verify your email address before withdrawing.');
  if (user.payout_hold) throw new AppError('Withdrawals are paused on your account while we review recent activity. Contact support.');
  const ageDays = (now() - user.created_at) / DAY;
  if (ageDays < config.minAccountAgeDaysForPayout) {
    throw new AppError(`New accounts can withdraw after ${config.minAccountAgeDaysForPayout} days. This protects everyone from fraud.`);
  }
}

/** Robux withdrawal: held immediately, refunded if rejected. An admin buys the gamepass. */
export async function requestWithdrawal(user: Payer & { created_at: number }, amount: number, gamepassUrl: string) {
  await assertCanWithdraw(user);
  const gp = parseGamepassId(gamepassUrl);
  if (!gp) throw new AppError('Enter a valid Roblox gamepass link, e.g. roblox.com/game-pass/123456.');
  if (amount < MIN_WITHDRAWAL.ROBUX) throw new AppError(`Minimum withdrawal is R$ ${MIN_WITHDRAWAL.ROBUX}.`);
  return tx(async () => {
    await postEntry(user.id, -amount, 'withdrawal', { note: `Withdrawal to gamepass ${gp}` });
    await run(
      "INSERT INTO payment_requests (id, user_id, kind, amount, currency, gamepass_url, created_at) VALUES (?,?,'withdrawal',?,'ROBUX',?,?)",
      uid(), user.id, amount, gp, now(),
    );
    await notifyAdmins('Withdrawal to process', `${fmtMoney(amount, 'ROBUX')} → gamepass ${gp}`, '/admin/payments');
  });
}

export function resolvePayment(adminId: string, requestId: string, approve: boolean, note: string) {
  return tx(async () => {
    const r = await get<PaymentRequest>('SELECT * FROM payment_requests WHERE id = ?', requestId);
    if (!r) throw new AppError('Request not found.');
    // Compare-and-swap so two admins (or a double click) can't resolve the same request twice.
    const won = await run("UPDATE payment_requests SET status = ?, admin_note = ?, resolved_at = ? WHERE id = ? AND status = 'pending'", approve ? 'completed' : 'rejected', note, now(), r.id);
    if (!won.changes) throw new AppError('Already resolved.');
    if (r.kind === 'deposit' && approve) await postEntry(r.user_id, r.amount, 'deposit', { currency: r.currency, note: 'Deposit confirmed' });
    if (r.kind === 'withdrawal' && !approve) await postEntry(r.user_id, r.amount, 'withdrawal_refund', { currency: r.currency, note: 'Withdrawal rejected' });
    const label = r.kind === 'deposit' ? 'Deposit' : 'Withdrawal';
    await notify(r.user_id, `${label} ${approve ? 'completed' : 'rejected'}`, `${fmtMoney(r.amount, r.currency)}${note ? ` · ${note}` : ''}`, '/app/wallet');
    await audit(adminId, `payment.${r.kind}.${approve ? 'complete' : 'reject'}`, r.id, { amount: r.amount, currency: r.currency });
  });
}

/* ----------------------------------------------------------- USD (Stripe) */

/**
 * Credit a card deposit exactly once. Stripe retries webhooks, so the unique (provider, provider_ref) index is the
 * idempotency guard: the second delivery inserts nothing and credits nothing.
 */
export function creditStripeDeposit(opts: { sessionId: string; paymentIntent: string | null; userId: string; creditCents: number }) {
  return tx(async () => {
    const ins = await get<{ id: string }>(
      `INSERT INTO payment_requests (id, user_id, kind, amount, currency, status, provider, provider_ref, reference, created_at, resolved_at)
       VALUES (?,?,'deposit',?,'USD','completed','stripe',?,?,?,?) ON CONFLICT DO NOTHING RETURNING id`,
      uid(), opts.userId, opts.creditCents, opts.sessionId, opts.paymentIntent, now(), now(),
    );
    if (!ins) return false;
    await postEntry(opts.userId, opts.creditCents, 'deposit', { currency: 'USD', note: 'Card deposit' });
    await notify(opts.userId, 'Deposit received', `${fmtMoney(opts.creditCents, 'USD')} was added to your wallet.`, '/app/wallet');
    return true;
  });
}

/** A card payment was disputed (chargeback): pause that user's payouts and alert admins. */
export async function flagChargeback(paymentIntent: string) {
  const r = await get<{ user_id: string }>("SELECT user_id FROM payment_requests WHERE provider = 'stripe' AND reference = ? AND kind = 'deposit'", paymentIntent);
  if (!r) return;
  await run('UPDATE users SET payout_hold = 1 WHERE id = ?', r.user_id);
  await audit(null, 'stripe.dispute', r.user_id, { paymentIntent });
  await notifyAdmins('Card chargeback opened', 'Payouts for this user are paused. Review in Admin > Users.', '/admin/users');
}

/** USD that can be withdrawn now: balance minus recent sale earnings still inside the chargeback window. */
export async function withdrawableUsd(userId: string, balance: number): Promise<{ withdrawable: number; locked: number }> {
  const since = now() - config.usdPayoutHoldDays * DAY;
  const row = await get<{ s: number }>("SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE user_id = ? AND currency = 'USD' AND kind = 'sale' AND created_at > ?", userId, since);
  const locked = Math.min(balance, row?.s ?? 0);
  return { withdrawable: Math.max(0, balance - locked), locked };
}

/**
 * USD withdrawal to the creator's Stripe Connect account. The amount is debited first; then we attempt the transfer.
 * If Stripe can't do it right now (for example the platform's balance hasn't settled yet) the request stays pending
 * for an admin instead of failing the user.
 */
export async function requestUsdWithdrawal(user: Payer & { created_at: number; balance_usd: number; stripe_account_id: string | null }, cents: number) {
  await assertCanWithdraw(user);
  if (!user.stripe_account_id) throw new AppError('Set up payouts first.');
  if (cents < MIN_WITHDRAWAL.USD) throw new AppError(`Minimum withdrawal is ${fmtMoney(MIN_WITHDRAWAL.USD, 'USD')}.`);
  const { withdrawable, locked } = await withdrawableUsd(user.id, user.balance_usd);
  if (cents > withdrawable) {
    throw new AppError(locked > 0
      ? `You can withdraw up to ${fmtMoney(withdrawable, 'USD')} now. ${fmtMoney(locked, 'USD')} of recent earnings unlocks ${config.usdPayoutHoldDays} days after each sale.`
      : `You can withdraw up to ${fmtMoney(withdrawable, 'USD')}.`);
  }
  const id = uid();
  await tx(async () => {
    await postEntry(user.id, -cents, 'withdrawal', { currency: 'USD', note: 'Withdrawal to bank via Stripe' });
    await run(
      "INSERT INTO payment_requests (id, user_id, kind, amount, currency, provider, created_at) VALUES (?,?,'withdrawal',?,'USD','stripe',?)",
      id, user.id, cents, now(),
    );
  });
  try {
    const t = await createTransfer({ accountId: user.stripe_account_id, cents, idempotencyKey: `payout-${id}`, description: 'CreatorLink payout' });
    await run("UPDATE payment_requests SET status = 'completed', provider_ref = ?, resolved_at = ? WHERE id = ? AND status = 'pending'", t.id, now(), id);
    await notify(user.id, 'Payout sent', `${fmtMoney(cents, 'USD')} is on its way to your bank account.`, '/app/wallet');
    return { status: 'completed' as const };
  } catch (e) {
    console.error('[stripe] transfer failed', id, e instanceof Error ? e.message : e);
    await notifyAdmins('USD payout needs attention', `${fmtMoney(cents, 'USD')} transfer failed. Process it in Admin > Payments.`, '/admin/payments');
    return { status: 'pending' as const };
  }
}

export function listPending(userId: string) {
  return all<PaymentRequest>("SELECT * FROM payment_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC", userId);
}
