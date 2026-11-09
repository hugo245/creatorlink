import { all, get, run, tx, now, uid } from './db';
import { config, DAY, HOUR } from './config';
import { AppError, audit, notify, postEntry } from './ledger';

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

export function getOrder(id: string) {
  return get<Order>('SELECT * FROM orders WHERE id = ?', id);
}

function mustOrder(id: string): Order {
  const o = getOrder(id);
  if (!o) throw new AppError('Order not found.');
  return o;
}

export function systemMessage(orderId: string, body: string) {
  run(
    "INSERT INTO messages (id, order_id, sender_id, kind, body, created_at) VALUES (?,?,NULL,'system',?,?)",
    uid(), orderId, body, now(),
  );
}

function setStatus(o: Order, status: OrderStatus, extra: Record<string, string | number | null> = {}) {
  const cols = Object.keys(extra);
  const sets = ['status = ?', 'updated_at = ?', ...cols.map((c) => `${c} = ?`)].join(', ');
  run(`UPDATE orders SET ${sets} WHERE id = ?`, status, now(), ...cols.map((c) => extra[c]), o.id);
}

const orderHref = (id: string) => `/app/orders/${id}`;

/* ------------------------------------------------------------------ create */

export type NewOrder = { buyerId: string; packageId: string; gameName: string; gameUrl: string; brief: string };

export function createOrder(input: NewOrder): string {
  return tx(() => {
    const pkg = get<{
      id: string; title: string; price: number; delivery_days: number; revisions: number; active: number;
      creator_id: string; user_id: string; status: string; is_listed: number; display_name: string;
    }>(
      `SELECT p.*, c.user_id, c.status, c.is_listed, c.display_name
         FROM packages p JOIN creators c ON c.id = p.creator_id WHERE p.id = ?`,
      input.packageId,
    );
    if (!pkg || !pkg.active || pkg.status !== 'approved' || !pkg.is_listed) {
      throw new AppError('This package is no longer available.');
    }
    if (pkg.user_id === input.buyerId) throw new AppError("You can't order from your own listing.");

    const id = uid();
    const t = now();
    const fee = feeFor(pkg.price);
    run(
      `INSERT INTO orders (id, buyer_id, creator_id, seller_user_id, package_id, package_title, price, fee,
         delivery_days, revisions_allowed, game_name, game_url, brief, status, respond_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
      id, input.buyerId, pkg.creator_id, pkg.user_id, pkg.id, pkg.title, pkg.price, fee,
      pkg.delivery_days, pkg.revisions, input.gameName, input.gameUrl, input.brief,
      t + config.acceptWindowHours * HOUR, t, t,
    );
    // Funds leave the buyer's balance and sit in escrow (held on the order) until release or refund.
    postEntry(input.buyerId, -pkg.price, 'escrow_hold', { orderId: id, note: `Escrow for “${pkg.title}”` });
    systemMessage(id, `Order placed. R$ ${pkg.price.toLocaleString('en-US')} is held in escrow until the work is approved.`);
    notify(pkg.user_id, 'New order request', `${input.gameName} · ${pkg.title}`, orderHref(id));
    return id;
  });
}

/* ------------------------------------------------------- seller transitions */

export function acceptOrder(orderId: string, userId: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can accept this order.');
    if (o.status !== 'pending') throw new AppError('This order is no longer awaiting a response.');
    setStatus(o, 'active', { due_at: now() + o.delivery_days * DAY, respond_by: null });
    systemMessage(o.id, `Creator accepted the order. Delivery is due in ${o.delivery_days} day${o.delivery_days === 1 ? '' : 's'}.`);
    notify(o.buyer_id, 'Order accepted', `${o.game_name} is now in production.`, orderHref(o.id));
  });
}

export function declineOrder(orderId: string, userId: string, reason: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can decline this order.');
    if (o.status !== 'pending') throw new AppError('This order is no longer awaiting a response.');
    refundBuyer(o, 'declined', reason || 'Declined by creator');
    systemMessage(o.id, `Creator declined the order${reason ? `: “${reason}”` : '.'} The escrow was refunded.`);
    notify(o.buyer_id, 'Order declined', `Your R$ ${o.price.toLocaleString('en-US')} was refunded.`, orderHref(o.id));
  });
}

export function deliverOrder(orderId: string, userId: string, url: string, note: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.seller_user_id !== userId) throw new AppError('Only the creator can deliver this order.');
    if (o.status !== 'active') throw new AppError('This order is not in production.');
    setStatus(o, 'delivered', {
      delivery_url: url, delivery_note: note, delivered_at: now(),
      auto_release_at: now() + config.reviewWindowHours * HOUR,
    });
    systemMessage(o.id, `Creator delivered the work: ${url}`);
    notify(o.buyer_id, 'Your order was delivered', 'Review it and release the funds, or request a revision.', orderHref(o.id));
  });
}

/* -------------------------------------------------------- buyer transitions */

export function cancelOrder(orderId: string, userId: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can cancel this order.');
    const late = o.status === 'active' && o.due_at !== null && o.due_at < now();
    if (o.status !== 'pending' && !late) {
      throw new AppError('You can only cancel before the creator responds, or after a missed deadline.');
    }
    refundBuyer(o, 'cancelled', o.status === 'pending' ? 'Cancelled by buyer' : 'Deadline missed');
    systemMessage(o.id, 'Buyer cancelled the order. The escrow was refunded.');
    notify(o.seller_user_id, 'Order cancelled', `${o.game_name} was cancelled by the buyer.`, orderHref(o.id));
  });
}

export function requestRevision(orderId: string, userId: string, message: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can request a revision.');
    if (o.status !== 'delivered') throw new AppError('There is no delivery to revise.');
    if (o.revisions_used >= o.revisions_allowed) throw new AppError('No revisions left on this order.');
    setStatus(o, 'active', {
      revisions_used: o.revisions_used + 1, auto_release_at: null, due_at: now() + 3 * DAY,
    });
    systemMessage(o.id, `Buyer requested a revision (${o.revisions_used + 1}/${o.revisions_allowed}): “${message}”`);
    notify(o.seller_user_id, 'Revision requested', message.slice(0, 120), orderHref(o.id));
  });
}

export function approveOrder(orderId: string, userId: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can release the funds.');
    if (o.status !== 'delivered') throw new AppError('Nothing to release yet.');
    release(o, 'Buyer approved the delivery.');
  });
}

/* ----------------------------------------------------------------- disputes */

export function openDispute(orderId: string, userId: string, reason: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.buyer_id !== userId && o.seller_user_id !== userId) throw new AppError('Not your order.');
    if (o.status !== 'active' && o.status !== 'delivered') throw new AppError("This order can't be disputed right now.");
    setStatus(o, 'disputed', { dispute_reason: reason, dispute_by: userId, auto_release_at: null });
    systemMessage(o.id, 'A dispute was opened. CreatorLink support will review the conversation and deliverables.');
    const other = userId === o.buyer_id ? o.seller_user_id : o.buyer_id;
    notify(other, 'Dispute opened', reason.slice(0, 120), orderHref(o.id));
    for (const a of all<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")) {
      notify(a.id, 'Dispute needs review', `${o.game_name} · R$ ${o.price.toLocaleString('en-US')}`, '/admin/disputes');
    }
  });
}

export function resolveDispute(orderId: string, adminId: string, outcome: 'release' | 'refund', note: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.status !== 'disputed') throw new AppError('This order is not in dispute.');
    run('UPDATE orders SET dispute_note = ? WHERE id = ?', note, o.id);
    if (outcome === 'release') release(o, `Support resolved the dispute in the creator's favour. ${note}`.trim());
    else {
      refundBuyer(o, 'refunded', note || 'Dispute resolved for buyer');
      systemMessage(o.id, `Support resolved the dispute in the buyer's favour and refunded the escrow. ${note}`.trim());
    }
    audit(adminId, `dispute.${outcome}`, o.id, { note });
    for (const uid_ of [o.buyer_id, o.seller_user_id]) {
      notify(uid_, 'Dispute resolved', outcome === 'release' ? 'Funds were released to the creator.' : 'Funds were refunded to the buyer.', orderHref(o.id));
    }
  });
}

/* ------------------------------------------------------------ money helpers */

function refundBuyer(o: Order, status: 'cancelled' | 'declined' | 'refunded', reason: string) {
  postEntry(o.buyer_id, o.price, 'escrow_refund', { orderId: o.id, note: `Refund · ${o.package_title}` });
  setStatus(o, status, { closed_reason: reason, respond_by: null, due_at: null, auto_release_at: null, completed_at: now() });
}

function release(o: Order, message: string) {
  const payout = o.price - o.fee;
  postEntry(o.seller_user_id, payout, 'sale', { orderId: o.id, note: `${o.package_title} (fee R$ ${o.fee.toLocaleString('en-US')})` });
  setStatus(o, 'completed', { completed_at: now(), auto_release_at: null });
  run('UPDATE creators SET completed_orders = completed_orders + 1 WHERE id = ?', o.creator_id);
  systemMessage(o.id, `${message} R$ ${payout.toLocaleString('en-US')} was released to the creator.`);
  notify(o.seller_user_id, 'Funds released', `You earned R$ ${payout.toLocaleString('en-US')} for ${o.game_name}.`, orderHref(o.id));
  notify(o.buyer_id, 'Order completed', 'Leave a review to help other developers.', orderHref(o.id));
}

/* ------------------------------------------------------------------ reviews */

export function addReview(orderId: string, userId: string, rating: number, body: string) {
  tx(() => {
    const o = mustOrder(orderId);
    if (o.buyer_id !== userId) throw new AppError('Only the buyer can review this order.');
    if (o.status !== 'completed') throw new AppError('You can review once the order is completed.');
    if (get('SELECT 1 FROM reviews WHERE order_id = ?', o.id)) throw new AppError('You already reviewed this order.');
    run(
      'INSERT INTO reviews (id, order_id, buyer_id, creator_id, rating, body, created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), o.id, userId, o.creator_id, rating, body, now(),
    );
    run('UPDATE creators SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', rating, o.creator_id);
    notify(o.seller_user_id, `New ${rating}★ review`, body.slice(0, 120), orderHref(o.id));
  });
}

/* ------------------------------------------------------------------ sweeper */

let lastSweep = 0;
/** Applies time-based transitions: expired requests are refunded, stale deliveries auto-release. Cheap; throttled. */
export function sweepOrders(force = false) {
  const t = now();
  if (!force && t - lastSweep < 30_000) return;
  lastSweep = t;
  const expired = all<{ id: string }>("SELECT id FROM orders WHERE status = 'pending' AND respond_by < ?", t);
  for (const { id } of expired) {
    tx(() => {
      const o = mustOrder(id);
      if (o.status !== 'pending') return;
      refundBuyer(o, 'cancelled', 'Creator did not respond in time');
      systemMessage(o.id, 'The creator did not respond in time. The order was cancelled and the escrow refunded.');
      notify(o.buyer_id, 'Order expired', `Your R$ ${o.price.toLocaleString('en-US')} was refunded.`, orderHref(o.id));
    });
  }
  const stale = all<{ id: string }>("SELECT id FROM orders WHERE status = 'delivered' AND auto_release_at < ?", t);
  for (const { id } of stale) {
    tx(() => {
      const o = mustOrder(id);
      if (o.status !== 'delivered') return;
      release(o, `The ${config.reviewWindowHours}h review window passed, so the delivery was auto-approved.`);
    });
  }
}
