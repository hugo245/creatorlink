import { all, get, run, tx, now, uid } from './db';
import { config } from './config';
import { AppError, audit, notify, postEntry } from './ledger';

export type PaymentRequest = {
  id: string;
  user_id: string;
  kind: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  gamepass_url: string | null;
  reference: string | null;
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

/** Dev-only instant top-up. Guarded by ENABLE_TEST_FUNDS. */
export function addTestFunds(userId: string, amount: number) {
  if (!config.testFunds) throw new AppError('Test funds are disabled.');
  tx(() => postEntry(userId, amount, 'test_deposit', { note: 'Test funds' }));
}

export function requestDeposit(userId: string, amount: number, reference: string) {
  if (amount < config.minDeposit) throw new AppError(`Minimum deposit is R$ ${config.minDeposit}.`);
  tx(() => {
    const pending = get<{ n: number }>("SELECT COUNT(*) n FROM payment_requests WHERE user_id = ? AND kind = 'deposit' AND status = 'pending'", userId)!;
    if (pending.n >= 3) throw new AppError('You already have 3 deposits awaiting confirmation.');
    run(
      "INSERT INTO payment_requests (id, user_id, kind, amount, reference, created_at) VALUES (?,?,'deposit',?,?,?)",
      uid(), userId, amount, reference, now(),
    );
    for (const a of all<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")) {
      notify(a.id, 'Deposit awaiting confirmation', `R$ ${amount.toLocaleString('en-US')}`, '/admin/payments');
    }
  });
}

/** Withdrawals debit the balance immediately (held) and are refunded if rejected. */
export function requestWithdrawal(userId: string, amount: number, gamepassUrl: string) {
  const gp = parseGamepassId(gamepassUrl);
  if (!gp) throw new AppError('Enter a valid Roblox gamepass link, e.g. roblox.com/game-pass/123456.');
  if (amount < config.minWithdrawal) throw new AppError(`Minimum withdrawal is R$ ${config.minWithdrawal}.`);
  tx(() => {
    const id = uid();
    postEntry(userId, -amount, 'withdrawal', { note: `Withdrawal to gamepass ${gp}` });
    run(
      "INSERT INTO payment_requests (id, user_id, kind, amount, gamepass_url, created_at) VALUES (?,?,'withdrawal',?,?,?)",
      id, userId, amount, gp, now(),
    );
    for (const a of all<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")) {
      notify(a.id, 'Withdrawal to process', `R$ ${amount.toLocaleString('en-US')} → gamepass ${gp}`, '/admin/payments');
    }
  });
}

export function resolvePayment(adminId: string, requestId: string, approve: boolean, note: string) {
  tx(() => {
    const r = get<PaymentRequest>('SELECT * FROM payment_requests WHERE id = ?', requestId);
    if (!r) throw new AppError('Request not found.');
    if (r.status !== 'pending') throw new AppError('Already resolved.');
    run('UPDATE payment_requests SET status = ?, admin_note = ?, resolved_at = ? WHERE id = ?', approve ? 'completed' : 'rejected', note, now(), r.id);
    if (r.kind === 'deposit' && approve) {
      postEntry(r.user_id, r.amount, 'deposit', { note: 'Deposit confirmed' });
    }
    if (r.kind === 'withdrawal' && !approve) {
      postEntry(r.user_id, r.amount, 'withdrawal_refund', { note: 'Withdrawal rejected' });
    }
    const label = r.kind === 'deposit' ? 'Deposit' : 'Withdrawal';
    notify(
      r.user_id,
      `${label} ${approve ? 'completed' : 'rejected'}`,
      `R$ ${r.amount.toLocaleString('en-US')}${note ? ` · ${note}` : ''}`,
      '/app/wallet',
    );
    audit(adminId, `payment.${r.kind}.${approve ? 'complete' : 'reject'}`, r.id, { amount: r.amount });
  });
}
