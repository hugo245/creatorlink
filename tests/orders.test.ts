import { beforeEach, describe, expect, it } from 'vitest';
import { all, get, run, uid } from '@/lib/db';
import {
  acceptOrder, addReview, approveOrder, cancelOrder, createOrder, declineOrder, deliverOrder,
  getOrder, openDispute, requestRevision, resolveDispute, sweepOrders,
} from '@/lib/orders';
import { requestWithdrawal, parseGamepassId, requestDeposit, resolvePayment } from '@/lib/wallet';
import { postEntry } from '@/lib/ledger';

let buyer: string, seller: string, admin: string, creatorId: string, pkg: string;

const bal = async (id: string) => (await get<{ balance: number }>('SELECT balance FROM users WHERE id = ?', id))!.balance;

async function mkUser(name: string, role = 'user') {
  const id = uid();
  await run('INSERT INTO users (id,email,username,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', id, `${name}@t.dev`, name, 'x', role, Date.now());
  return id;
}

beforeEach(async () => {
  for (const t of ['password_resets', 'rate_limits', 'reviews', 'messages', 'transactions', 'payment_requests', 'notifications', 'audit_log', 'orders', 'packages', 'creators', 'users']) {
    await run(`DELETE FROM ${t}`);
  }
  buyer = await mkUser('buyer');
  seller = await mkUser('seller');
  admin = await mkUser('admin', 'admin');
  creatorId = uid();
  await run(
    "INSERT INTO creators (id,user_id,slug,display_name,status,created_at) VALUES (?,?,?,?,'approved',?)",
    creatorId, seller, 'seller', 'Seller', Date.now(),
  );
  pkg = uid();
  await run(
    'INSERT INTO packages (id,creator_id,title,price,delivery_days,revisions,created_at) VALUES (?,?,?,?,?,?,?)',
    pkg, creatorId, 'Short', 1000, 3, 1, Date.now(),
  );
  await postEntry(buyer, 5000, 'deposit');
});

const place = () => createOrder({ buyerId: buyer, packageId: pkg, gameName: 'Obby', gameUrl: 'https://roblox.com/games/1', brief: 'x' });

describe('escrow lifecycle', () => {
  it('holds funds on order, pays creator minus fee on approval', async () => {
    const id = await place();
    expect(await bal(buyer)).toBe(4000);
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', 'done');
    await approveOrder(id, buyer);
    expect((await getOrder(id))!.status).toBe('completed');
    expect(await bal(seller)).toBe(900); // 10% fee
    expect(await bal(buyer)).toBe(4000);
    expect((await get<{ completed_orders: number }>('SELECT completed_orders FROM creators WHERE id = ?', creatorId))!.completed_orders).toBe(1);
  });

  it('refunds when the creator declines', async () => {
    const id = await place();
    await declineOrder(id, seller, 'busy');
    expect((await getOrder(id))!.status).toBe('declined');
    expect(await bal(buyer)).toBe(5000);
  });

  it('lets the buyer cancel only while pending', async () => {
    const id = await place();
    await cancelOrder(id, buyer);
    expect(await bal(buyer)).toBe(5000);
    const id2 = await place();
    await acceptOrder(id2, seller);
    await expect((async () => await cancelOrder(id2, buyer))()).rejects.toThrow();
    await run('UPDATE orders SET due_at = ? WHERE id = ?', Date.now() - 1000, id2);
    await cancelOrder(id2, buyer); // late → allowed
    expect(await bal(buyer)).toBe(5000);
  });

  it('enforces revision limits', async () => {
    const id = await place();
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await requestRevision(id, buyer, 'more energy');
    await deliverOrder(id, seller, 'https://youtu.be/y', '');
    await expect((async () => await requestRevision(id, buyer, 'again'))()).rejects.toThrow(/No revisions/);
  });

  it('blocks unauthorised actors', async () => {
    const id = await place();
    await expect((async () => await acceptOrder(id, buyer))()).rejects.toThrow();
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await expect((async () => await approveOrder(id, seller))()).rejects.toThrow();
    await expect((async () => await approveOrder(id, await mkUser('rando')))()).rejects.toThrow();
  });

  it('rejects insufficient funds without side effects', async () => {
    await run('UPDATE packages SET price = 9000 WHERE id = ?', pkg);
    await expect((async () => await place())()).rejects.toThrow(/Not enough/);
    expect(await all('SELECT * FROM orders')).toHaveLength(0);
    expect(await bal(buyer)).toBe(5000);
  });

  it("won't let a creator order their own listing", async () => {
    await postEntry(seller, 2000, 'deposit');
    await expect((async () => await createOrder({ buyerId: seller, packageId: pkg, gameName: 'g', gameUrl: 'https://x.y', brief: '' }))()).rejects.toThrow(/own listing/);
  });

  it('resolves disputes either way', async () => {
    const a = await place();
    await acceptOrder(a, seller);
    await openDispute(a, buyer, 'never delivered');
    await resolveDispute(a, admin, 'refund', 'ok');
    expect((await getOrder(a))!.status).toBe('refunded');
    expect(await bal(buyer)).toBe(5000);

    const b = await place();
    await acceptOrder(b, seller);
    await deliverOrder(b, seller, 'https://youtu.be/x', '');
    await openDispute(b, buyer, 'quality');
    await resolveDispute(b, admin, 'release', 'delivered as agreed');
    expect((await getOrder(b))!.status).toBe('completed');
    expect(await bal(seller)).toBe(900);
  });

  it('sweeps expired requests and stale deliveries', async () => {
    const a = await place();
    await run('UPDATE orders SET respond_by = ? WHERE id = ?', Date.now() - 1, a);
    const b = await place();
    await acceptOrder(b, seller);
    await deliverOrder(b, seller, 'https://youtu.be/x', '');
    await run('UPDATE orders SET auto_release_at = ? WHERE id = ?', Date.now() - 1, b);
    await sweepOrders(true);
    expect((await getOrder(a))!.status).toBe('cancelled');
    expect((await getOrder(b))!.status).toBe('completed');
    expect(await bal(buyer)).toBe(5000 - 1000 + 0); // a refunded, b paid out
  });

  it('allows one review per completed order and updates the rating', async () => {
    const id = await place();
    await expect((async () => await addReview(id, buyer, 5, 'x'))()).rejects.toThrow();
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await approveOrder(id, buyer);
    await addReview(id, buyer, 4, 'solid');
    await expect((async () => await addReview(id, buyer, 5, 'again'))()).rejects.toThrow(/already/);
    const c = (await get<{ rating_sum: number; rating_count: number }>('SELECT * FROM creators WHERE id = ?', creatorId))!;
    expect([c.rating_sum, c.rating_count]).toEqual([4, 1]);
  });
});

describe('wallet', () => {
  it('parses gamepass links', async () => {
    expect(parseGamepassId('https://www.roblox.com/game-pass/123456/Name')).toBe('123456');
    expect(parseGamepassId('roblox.com/game-pass/1')).toBeNull();
    expect(parseGamepassId('https://evil.com/game-pass/123456')).toBeNull();
    expect(parseGamepassId('987654')).toBe('987654');
  });

  it('holds withdrawals and refunds on rejection', async () => {
    await requestWithdrawal(buyer, 1000, '123456');
    expect(await bal(buyer)).toBe(4000);
    const r = (await get<{ id: string }>("SELECT id FROM payment_requests WHERE kind = 'withdrawal'"))!;
    await resolvePayment(admin, r.id, false, 'bad link');
    expect(await bal(buyer)).toBe(5000);
    await expect((async () => await resolvePayment(admin, r.id, false, ''))()).rejects.toThrow(/Already/);
  });

  it('credits deposits only once confirmed', async () => {
    await requestDeposit(buyer, 500, 'ref');
    expect(await bal(buyer)).toBe(5000);
    const r = (await get<{ id: string }>("SELECT id FROM payment_requests WHERE kind = 'deposit'"))!;
    await resolvePayment(admin, r.id, true, '');
    expect(await bal(buyer)).toBe(5500);
  });
});

describe('ledger integrity', () => {
  it('transactions always sum to the balance', async () => {
    const id = await place();
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await approveOrder(id, buyer);
    for (const u of [buyer, seller]) {
      const sum = (await get<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id = ?', u))!.s;
      expect(sum).toBe(await bal(u));
    }
  });
});

describe('races', () => {
  it('pays the creator once when approval is submitted twice at the same time', async () => {
    const id = await place();
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    const results = await Promise.allSettled([approveOrder(id, buyer), approveOrder(id, buyer), approveOrder(id, buyer)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await bal(seller)).toBe(900);
  });

  it('cannot spend the same balance on two orders at once', async () => {
    await run('UPDATE users SET balance = 1000 WHERE id = ?', buyer);
    const results = await Promise.allSettled([place(), place()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await bal(buyer)).toBe(0);
  });

  it('never refunds an order twice', async () => {
    const id = await place();
    const results = await Promise.allSettled([cancelOrder(id, buyer), declineOrder(id, seller, 'no')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await bal(buyer)).toBe(5000);
  });
});

describe('password reset tokens', () => {
  it('are single-use and expire', async () => {
    const claim = (hash: string) =>
      get<{ user_id: string }>('UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id', Date.now(), hash, Date.now());
    await run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', 'good', buyer, Date.now() + 60_000);
    await run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', 'old', buyer, Date.now() - 1);
    const [a, b] = await Promise.all([claim('good'), claim('good')]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claim('old')).toBeUndefined();
  });
});
