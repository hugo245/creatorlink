import { all, get, run, now, uid } from './db';
import { balanceColumn, type Currency } from './money';

/** Error whose message is safe to show to end users. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export type TxKind =
  | 'deposit'
  | 'test_deposit'
  | 'withdrawal'
  | 'withdrawal_refund'
  | 'escrow_hold'
  | 'escrow_refund'
  | 'sale'
  | 'adjustment';

/**
 * Move `amount` (positive = credit, negative = debit) on a user's available balance and record it.
 * This is the ONLY code that changes `users.balance`. The update is a single atomic statement guarded by a
 * CHECK (balance >= 0) constraint, so concurrent requests can never overspend.
 */
export async function postEntry(
  userId: string, amount: number, kind: TxKind,
  opts: { orderId?: string; note?: string; currency?: Currency } = {},
) {
  if (!Number.isInteger(amount) || amount === 0) throw new Error('Invalid ledger amount');
  const currency = opts.currency ?? 'ROBUX';
  const col = balanceColumn(currency); // whitelisted column name, never user input
  let row: { balance: number } | undefined;
  try {
    row = await get<{ balance: number }>(`UPDATE users SET ${col} = ${col} + ? WHERE id = ? RETURNING ${col} AS balance`, amount, userId);
  } catch (e) {
    if ((e as { code?: string }).code === '23514') throw new AppError(`Not enough ${currency === 'USD' ? 'USD' : 'Robux'} in your balance.`);
    throw e;
  }
  if (!row) throw new AppError('Account not found.');
  await run(
    'INSERT INTO transactions (id, user_id, kind, amount, balance_after, order_id, note, created_at, currency) VALUES (?,?,?,?,?,?,?,?,?)',
    uid(), userId, kind, amount, row.balance, opts.orderId ?? null, opts.note ?? null, now(), currency,
  );
  return row.balance;
}

export async function notify(userId: string, title: string, body = '', href: string | null = null) {
  await run(
    'INSERT INTO notifications (id, user_id, title, body, href, created_at) VALUES (?,?,?,?,?,?)',
    uid(), userId, title, body, href, now(),
  );
}

export async function notifyAdmins(title: string, body: string, href: string) {
  for (const a of await all<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")) await notify(a.id, title, body, href);
}

export async function audit(actorId: string | null, action: string, target?: string, meta?: unknown) {
  await run(
    'INSERT INTO audit_log (id, actor_id, action, target, meta, created_at) VALUES (?,?,?,?,?,?)',
    uid(), actorId, action, target ?? null, meta ? JSON.stringify(meta) : null, now(),
  );
}
