import { all, get, run, tx, now, uid } from './db';
import { config, DAY, HOUR } from './config';
import { AppError, audit, notify, notifyAdmins, postEntry } from './ledger';
import { fmtMoney, type Currency } from './money';

export type OrderStatus =
  | 'pending'
  | 'active'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'declined'
  | 'refunded';

export type Order = {
  id: string;
  buyer_id: string;
  creator_id: string;
  seller_user_id: string;
  package_id: string | null;
  package_title: string;
  price: number;
  fee: number;
  currency: Currency;
  delivery_days: number;
  revisions_allowed: number;
  revisions_used: number;
  game_name: string;
  game_url: string;
  brief: string;
  status: OrderStatus;
  respond_by: number | null;
  due_at: number | null;
  delivery_url: string | null;
  delivery_note: string | null;
  delivered_at: number | null;
  auto_release_at: number | null;
  dispute_reason: string | null;
  dispute_by: string | null;
  dispute_note: string | null;
  closed_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

export const feeFor = (price: number) => Math.floor((price * config.feeBps) / 10_000);
const fmt = (n: number, c: Currency = 'ROBUX') => fmtMoney(n, c);

export function getOrder(id: string) {
  return get<Order>('SELECT * FROM orders WHERE id = ?', id);
}

async function mustOrder(id: string): Promise<Order> {
  const o = await getOrder(id);
  if (!o) throw new AppError('Order not found.');
  return o;
}

export async function systemMessage(orderId: string, body: string) {
  await run("INSERT INTO messages (id, order_id, sender_id, kind, body, created_at) VALUES (?,?,NULL,'system',?,?)", uid(), orderId, body, now());
}

/**
 * Compare-and-swap on status. If two requests race for the same transition (double-click, two tabs),
 * exactly one wins and the other changes nothing, so money can never move twice.
 */
async function setStatus(o: Order, status: OrderStatus, extra: Record<string, string | number | null> = {}) {
  const cols = Object.keys(extra);
  const sets = ['status = ?', 'updated_at = ?', ...cols.map((c) => `${c} = ?`)].join(', ');
  const r = await run(`UPDATE orders SET ${sets} WHERE id = ? AND status = ?`, status, now(), ...cols.map((c) => extra[c]), o.id, o.status);
  if (!r.changes) throw new AppError('This order was just updated. Refresh and try again.');
}

const orderHref = (id: string) => `/app/orders/${id}`;

/* ------------------------------------------------------------------ create */

export type NewOrder = { buyerId: string; packageId: string; gameName: string; gameUrl: string; brief: string };

export function createOrder(input: NewOrder): Promise<string> {
  return tx(async () => {
    const pkg = await get<{
      id: string; title: string; price: number; currency: Currency; delivery_days: number; revisions: number; active: number;
      creator_id: string; user_id: string; status: string; is_listed: number;
    }>(
      `SELECT p.id, p.title, p.price, p.currency, p.delivery_days, p.revisions, p.active, p.creator_id, c.user_id, c.status, c.is_listed
         FROM packages p JOIN creators c ON c.id = p.creator_id WHERE p.id = ?`,
      input.packageId,
    );
    if (!pkg || !pkg.active || pkg.status !== 'approved' || !pkg.is_listed) throw new AppError('This package is no longer available.');
    if (pkg.user_id === input.buyerId) throw new AppError("You can't order from your own listing.");

    const id = uid();
    const t = now();
    await run(
      `INSERT INTO orders (id, buyer_id, creator_id, seller_user_id, package_id, package_title, price, fee, currency,
         delivery_days, revisions_allowed, game_name, game_url, brief, status, respond_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
      id, input.buyerId, pkg.creator_id, pkg.user_id, pkg.id, pkg.title, pkg.price, feeFor(pkg.price), pkg.currency,
      pkg.delivery_days, pkg.revisions, input.gameName, input.gameUrl, input.brief,
      t + config.acceptWindowHours * HOUR, t, t,
    );
    // Funds leave the buyer's balance and are held on the order until release or refund.
    await postEntry(input.buyerId, -pkg.price, 'escrow_hold', { orderId: id, currency: pkg.currency, note: `Escrow for “${pkg.title}”` });
    await systemMessage(id, `Order placed. ${fmt(pkg.price, pkg.currency)} is held in escrow until the work is approved.`);
    await notify(pkg.user_id, 'New order request', `${input.gameName} · ${pkg.title}`, orderHref(id));
    return id;
  });
}

/* ------------------------------------------------------- seller transitions */

export function acceptOrder(orderId: string, userId: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can accept this order.');
    if (o.status !== 'pending') throw new AppError('This order is no longer awaiting a response.');
    await setStatus(o, 'active', { due_at: now() + o.delivery_days * DAY, respond_by: null });
    await systemMessage(o.id, `Creator accepted the order. Delivery is due in ${o.delivery_days} day${o.delivery_days === 1 ? '' : 's'}.`);
    await notify(o.buyer_id, 'Order accepted', `${o.game_name} is now in production.`, orderHref(o.id));
  });
}

export function declineOrder(orderId: string, userId: string, reason: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can decline this order.');
    if (o.status !== 'pending') throw new AppError('This order is no longer awaiting a response.');
    await refundBuyer(o, 'declined', reason || 'Declined by creator');
    await systemMessage(o.id, `Creator declined the order${reason ? `: “${reason}”` : '.'} The escrow was refunded.`);
    await notify(o.buyer_id, 'Order declined', `Your ${fmt(o.price, o.currency)} was refunded.`, orderHref(o.id));
  });
}

export function deliverOrder(orderId: string, userId: string, url: string, note: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can deliver this order.');
    if (o.status !== 'active') throw new AppError('This order is not in production.');
    await setStatus(o, 'delivered', { delivery_url: url, delivery_note: note, delivered_at: now(), auto_release_at: now() + config.reviewWindowHours * HOUR });
    await systemMessage(o.id, `Creator delivered the work: ${url}`);
    await notify(o.buyer_id, 'Your order was delivered', 'Review it and release the funds, or request a revision.', orderHref(o.id));
  });
}

/* -------------------------------------------------------- buyer transitions */

export function cancelOrder(orderId: string, userId: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can cancel this order.');
    const late = o.status === 'active' && o.due_at !== null && o.due_at < now();
    if (o.status !== 'pending' && !late) throw new AppError('You can only cancel before the creator responds, or after a missed deadline.');
    await refundBuyer(o, 'cancelled', o.status === 'pending' ? 'Cancelled by buyer' : 'Deadline missed');
    await systemMessage(o.id, 'Buyer cancelled the order. The escrow was refunded.');
    await notify(o.seller_user_id, 'Order cancelled', `${o.game_name} was cancelled by the buyer.`, orderHref(o.id));
  });
}

export function requestRevision(orderId: string, userId: string, message: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can request a revision.');
    if (o.status !== 'delivered') throw new AppError('There is no delivery to revise.');
    if (o.revisions_used >= o.revisions_allowed) throw new AppError('No revisions left on this order.');
    await setStatus(o, 'active', { revisions_used: o.revisions_used + 1, auto_release_at: null, due_at: now() + 3 * DAY });
    await systemMessage(o.id, `Buyer requested a revision (${o.revisions_used + 1}/${o.revisions_allowed}): “${message}”`);
    await notify(o.seller_user_id, 'Revision requested', message.slice(0, 120), orderHref(o.id));
  });
}

export function approveOrder(orderId: string, userId: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can release the funds.');
    if (o.status !== 'delivered') throw new AppError('Nothing to release yet.');
    await release(o, 'Buyer approved the delivery.');
  });
}

/* ----------------------------------------------------------------- disputes */

export function openDispute(orderId: string, userId: string, reason: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.buyer_id !== userId && o.seller_user_id !== userId) throw new AppError('Not your order.');
    if (o.status !== 'active' && o.status !== 'delivered') throw new AppError("This order can't be disputed right now.");
    await setStatus(o, 'disputed', { dispute_reason: reason, dispute_by: userId, auto_release_at: null });
    await systemMessage(o.id, 'A dispute was opened. CreatorLink support will review the conversation and deliverables.');
    await notify(userId === o.buyer_id ? o.seller_user_id : o.buyer_id, 'Dispute opened', reason.slice(0, 120), orderHref(o.id));
    await notifyAdmins('Dispute needs review', `${o.game_name} · ${fmt(o.price, o.currency)}`, '/admin/disputes');
  });
}

export function resolveDispute(orderId: string, adminId: string, outcome: 'release' | 'refund', note: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.status !== 'disputed') throw new AppError('This order is not in dispute.');
    await run('UPDATE orders SET dispute_note = ? WHERE id = ?', note, o.id);
    if (outcome === 'release') await release(o, `Support resolved the dispute in the creator's favour. ${note}`.trim());
    else {
      await refundBuyer(o, 'refunded', note || 'Dispute resolved for buyer');
      await systemMessage(o.id, `Support resolved the dispute in the buyer's favour and refunded the escrow. ${note}`.trim());
    }
    await audit(adminId, `dispute.${outcome}`, o.id, { note });
    for (const u of [o.buyer_id, o.seller_user_id]) {
      await notify(u, 'Dispute resolved', outcome === 'release' ? 'Funds were released to the creator.' : 'Funds were refunded to the buyer.', orderHref(o.id));
    }
  });
}

/* ------------------------------------------------------------ money helpers */
// Both helpers flip the status first (compare-and-swap), and only then move money.

async function refundBuyer(o: Order, status: 'cancelled' | 'declined' | 'refunded', reason: string) {
  await setStatus(o, status, { closed_reason: reason, respond_by: null, due_at: null, auto_release_at: null, completed_at: now() });
  await postEntry(o.buyer_id, o.price, 'escrow_refund', { orderId: o.id, currency: o.currency, note: `Refund · ${o.package_title}` });
}

async function release(o: Order, message: string) {
  const payout = o.price - o.fee;
  await setStatus(o, 'completed', { completed_at: now(), auto_release_at: null });
  await postEntry(o.seller_user_id, payout, 'sale', { orderId: o.id, currency: o.currency, note: `${o.package_title} (fee ${fmt(o.fee, o.currency)})` });
  await run('UPDATE creators SET completed_orders = completed_orders + 1 WHERE id = ?', o.creator_id);
  await systemMessage(o.id, `${message} ${fmt(payout, o.currency)} was released to the creator.`);
  await notify(o.seller_user_id, 'Funds released', `You earned ${fmt(payout, o.currency)} for ${o.game_name}.`, orderHref(o.id));
  await notify(o.buyer_id, 'Order completed', 'Leave a review to help other developers.', orderHref(o.id));
}

/* ------------------------------------------------------------------ reviews */

export function addReview(orderId: string, userId: string, rating: number, body: string) {
  return tx(async () => {
    const o = await mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can review this order.');
    if (o.status !== 'completed') throw new AppError('You can review once the order is completed.');
    if (await get('SELECT 1 AS x FROM reviews WHERE order_id = ?', o.id)) throw new AppError('You already reviewed this order.');
    await run(
      'INSERT INTO reviews (id, order_id, buyer_id, creator_id, rating, body, created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), o.id, userId, o.creator_id, rating, body, now(),
    );
    await run('UPDATE creators SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', rating, o.creator_id);
    await notify(o.seller_user_id, `New ${rating}★ review`, body.slice(0, 120), orderHref(o.id));
  });
}

/* ------------------------------------------------------------------ sweeper */

let lastSweep = 0;
/**
 * Applies time-based transitions: unanswered requests are refunded, stale deliveries auto-release.
 * Runs lazily (throttled) on app requests and on a schedule via /api/cron/sweep.
 */
export async function sweepOrders(force = false) {
  const t = now();
  if (!force && t - lastSweep < 30_000) return;
  lastSweep = t;
  const expired = await all<{ id: string }>("SELECT id FROM orders WHERE status = 'pending' AND respond_by < ?", t);
  for (const { id } of expired) {
    await tx(async () => {
      const o = await mustOrder(id);
      if (o.status !== 'pending') return;
      await refundBuyer(o, 'cancelled', 'Creator did not respond in time');
      await systemMessage(o.id, 'The creator did not respond in time. The order was cancelled and the escrow refunded.');
      await notify(o.buyer_id, 'Order expired', `Your ${fmt(o.price, o.currency)} was refunded.`, orderHref(o.id));
    }).catch(() => {});
  }
  const stale = await all<{ id: string }>("SELECT id FROM orders WHERE status = 'delivered' AND auto_release_at < ?", t);
  for (const { id } of stale) {
    await tx(async () => {
      const o = await mustOrder(id);
      if (o.status !== 'delivered') return;
      await release(o, `The ${config.reviewWindowHours}h review window passed, so the delivery was auto-approved.`);
    }).catch(() => {});
  }
  return { refunded: expired.length, released: stale.length };
}
