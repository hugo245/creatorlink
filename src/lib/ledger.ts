import { get, run, now, uid } from './db';

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

/** Move `amount` (positive = credit, negative = debit) on a user's available balance and record it. */
export function postEntry(userId: string, amount: number, kind: TxKind, opts: { orderId?: string; note?: string } = {}) {
  if (!Number.isInteger(amount) || amount === 0) throw new Error('Invalid ledger amount');
  const row = get<{ balance: number }>('SELECT balance FROM users WHERE id = ?', userId);
  if (!row) throw new AppError('Account not found.');
  const next = row.balance + amount;
  if (next < 0) throw new AppError('Not enough Robux in your balance.');
  run('UPDATE users SET balance = ? WHERE id = ?', next, userId);
  run(
    'INSERT INTO transactions (id, user_id, kind, amount, balance_after, order_id, note, created_at) VALUES (?,?,?,?,?,?,?,?)',
    uid(), userId, kind, amount, next, opts.orderId ?? null, opts.note ?? null, now(),
  );
  return next;
}

export function notify(userId: string, title: string, body = '', href: string | null = null) {
  run(
    'INSERT INTO notifications (id, user_id, title, body, href, created_at) VALUES (?,?,?,?,?,?)',
    uid(), userId, title, body, href, now(),
  );
}

export function audit(actorId: string | null, action: string, target?: string, meta?: unknown) {
  run(
    'INSERT INTO audit_log (id, actor_id, action, target, meta, created_at) VALUES (?,?,?,?,?,?)',
    uid(), actorId, action, target ?? null, meta ? JSON.stringify(meta) : null, now(),
  );
}
