import { beforeEach, describe, expect, it } from 'vitest';
import { all, get, run, uid } from '@/lib/db';
import {
  acceptOrder, addReview, approveOrder, cancelOrder, createOrder, declineOrder, deliverOrder,
  getOrder, openDispute, requestRevision, resolveDispute, sweepOrders,
} from '@/lib/orders';
import { requestWithdrawal, parseGamepassId, requestDeposit, resolvePayment } from '@/lib/wallet';
import { postEntry } from '@/lib/ledger';

let buyer: string, seller: string, admin: string, creatorId: string, pkg: string;

const bal = (id: string) => get<{ balance: number }>('SELECT balance FROM users WHERE id = ?', id)!.balance;

function mkUser(name: string, role = 'user') {
  const id = uid();
  run('INSERT INTO users (id,email,username,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', id, `${name}@t.dev`, name, 'x', role, Date.now());
  return id;
}

beforeEach(() => {
  for (const t of ['reviews', 'messages', 'transactions', 'payment_requests', 'notifications', 'audit_log', 'orders', 'packages', 'creators', 'users']) {
    run(`DELETE FROM ${t}`);
  }
  buyer = mkUser('buyer');
  seller = mkUser('seller');
  admin = mkUser('admin', 'admin');
  creatorId = uid();
  run(
    "INSERT INTO creators (id,user_id,slug,display_name,status,created_at) VALUES (?,?,?,?,'approved',?)",
    creatorId, seller, 'seller', 'Seller', Date.now(),
  );
  pkg = uid();
  run(
    'INSERT INTO packages (id,creator_id,title,price,delivery_days,revisions,created_at) VALUES (?,?,?,?,?,?,?)',
    pkg, creatorId, 'Short', 1000, 3, 1, Date.now(),
  );
  postEntry(buyer, 5000, 'deposit');
});

const place = () => createOrder({ buyerId: buyer, packageId: pkg, gameName: 'Obby', gameUrl: 'https://roblox.com/games/1', brief: 'x' });

describe('escrow lifecycle', () => {
  it('holds funds on order, pays creator minus fee on approval', () => {
    const id = place();
    expect(bal(buyer)).toBe(4000);
    acceptOrder(id, seller);
    deliverOrder(id, seller, 'https://youtu.be/x', 'done');
    approveOrder(id, buyer);
    expect(getOrder(id)!.status).toBe('completed');
    expect(bal(seller)).toBe(900); // 10% fee
    expect(bal(buyer)).toBe(4000);
    expect(get<{ completed_orders: number }>('SELECT completed_orders FROM creators WHERE id = ?', creatorId)!.completed_orders).toBe(1);
  });

  it('refunds when the creator declines', () => {
    const id = place();
    declineOrder(id, seller, 'busy');
    expect(getOrder(id)!.status).toBe('declined');
    expect(bal(buyer)).toBe(5000);
  });

  it('lets the buyer cancel only while pending', () => {
    const id = place();
    cancelOrder(id, buyer);
    expect(bal(buyer)).toBe(5000);
    const id2 = place();
    acceptOrder(id2, seller);
    expect(() => cancelOrder(id2, buyer)).toThrow();
    run('UPDATE orders SET due_at = ? WHERE id = ?', Date.now() - 1000, id2);
    cancelOrder(id2, buyer); // late → allowed
    expect(bal(buyer)).toBe(5000);
  });

  it('enforces revision limits', () => {
    const id = place();
    acceptOrder(id, seller);
    deliverOrder(id, seller, 'https://youtu.be/x', '');
    requestRevision(id, buyer, 'more energy');
    deliverOrder(id, seller, 'https://youtu.be/y', '');
    expect(() => requestRevision(id, buyer, 'again')).toThrow(/No revisions/);
  });

  it('blocks unauthorised actors', () => {
    const id = place();
    expect(() => acceptOrder(id, buyer)).toThrow();
    acceptOrder(id, seller);
    deliverOrder(id, seller, 'https://youtu.be/x', '');
    expect(() => approveOrder(id, seller)).toThrow();
    expect(() => approveOrder(id, mkUser('rando'))).toThrow();
  });

  it('rejects insufficient funds without side effects', () => {
    run('UPDATE packages SET price = 9000 WHERE id = ?', pkg);
    expect(() => place()).toThrow(/Not enough/);
    expect(all('SELECT * FROM orders')).toHaveLength(0);
    expect(bal(buyer)).toBe(5000);
  });

  it("won't let a creator order their own listing", () => {
    postEntry(seller, 2000, 'deposit');
    expect(() => createOrder({ buyerId: seller, packageId: pkg, gameName: 'g', gameUrl: 'https://x.y', brief: '' })).toThrow(/own listing/);
  });

  it('resolves disputes either way', () => {
    const a = place();
    acceptOrder(a, seller);
    openDispute(a, buyer, 'never delivered');
    resolveDispute(a, admin, 'refund', 'ok');
    expect(getOrder(a)!.status).toBe('refunded');
    expect(bal(buyer)).toBe(5000);

    const b = place();
    acceptOrder(b, seller);
    deliverOrder(b, seller, 'https://youtu.be/x', '');
    openDispute(b, buyer, 'quality');
    resolveDispute(b, admin, 'release', 'delivered as agreed');
    expect(getOrder(b)!.status).toBe('completed');
    expect(bal(seller)).toBe(900);
  });

  it('sweeps expired requests and stale deliveries', () => {
    const a = place();
    run('UPDATE orders SET respond_by = ? WHERE id = ?', Date.now() - 1, a);
    const b = place();
    acceptOrder(b, seller);
    deliverOrder(b, seller, 'https://youtu.be/x', '');
    run('UPDATE orders SET auto_release_at = ? WHERE id = ?', Date.now() - 1, b);
    sweepOrders(true);
    expect(getOrder(a)!.status).toBe('cancelled');
    expect(getOrder(b)!.status).toBe('completed');
    expect(bal(buyer)).toBe(5000 - 1000 + 0); // a refunded, b paid out
  });

  it('allows one review per completed order and updates the rating', () => {
    const id = place();
    expect(() => addReview(id, buyer, 5, 'x')).toThrow();
    acceptOrder(id, seller);
    deliverOrder(id, seller, 'https://youtu.be/x', '');
    approveOrder(id, buyer);
    addReview(id, buyer, 4, 'solid');
    expect(() => addReview(id, buyer, 5, 'again')).toThrow(/already/);
    const c = get<{ rating_sum: number; rating_count: number }>('SELECT * FROM creators WHERE id = ?', creatorId)!;
    expect([c.rating_sum, c.rating_count]).toEqual([4, 1]);
  });
});

describe('wallet', () => {
  it('parses gamepass links', () => {
    expect(parseGamepassId('https://www.roblox.com/game-pass/123456/Name')).toBe('123456');
    expect(parseGamepassId('roblox.com/game-pass/1')).toBeNull();
    expect(parseGamepassId('https://evil.com/game-pass/123456')).toBeNull();
    expect(parseGamepassId('987654')).toBe('987654');
  });

  it('holds withdrawals and refunds on rejection', () => {
    requestWithdrawal(buyer, 1000, '123456');
    expect(bal(buyer)).toBe(4000);
    const r = get<{ id: string }>("SELECT id FROM payment_requests WHERE kind = 'withdrawal'")!;
    resolvePayment(admin, r.id, false, 'bad link');
    expect(bal(buyer)).toBe(5000);
    expect(() => resolvePayment(admin, r.id, false, '')).toThrow(/Already/);
  });

  it('credits deposits only once confirmed', () => {
    requestDeposit(buyer, 500, 'ref');
    expect(bal(buyer)).toBe(5000);
    const r = get<{ id: string }>("SELECT id FROM payment_requests WHERE kind = 'deposit'")!;
    resolvePayment(admin, r.id, true, '');
    expect(bal(buyer)).toBe(5500);
  });
});

describe('ledger integrity', () => {
  it('transactions always sum to the balance', () => {
    const id = place();
    acceptOrder(id, seller);
    deliverOrder(id, seller, 'https://youtu.be/x', '');
    approveOrder(id, buyer);
    for (const u of [buyer, seller]) {
      const sum = get<{ s: number }>('SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE user_id = ?', u)!.s;
      expect(sum).toBe(bal(u));
    }
  });
});
