import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { all, get, run, uid } from '@/lib/db';
import { acceptOrder, approveOrder, createOrder, deliverOrder, getOrder } from '@/lib/orders';
import { assertCanWithdraw, creditStripeDeposit, flagChargeback, requestUsdWithdrawal, withdrawableUsd } from '@/lib/wallet';
import { postEntry } from '@/lib/ledger';
import { encodeForm, grossForCredit, verifyWebhook } from '@/lib/stripe';
import { fmtMoney } from '@/lib/money';

let buyer: string, seller: string, creatorId: string, usdPkg: string;
const NOW = Date.now();

async function mkUser(name: string, ageDays = 30) {
  const id = uid();
  await run(
    'INSERT INTO users (id,email,username,password_hash,email_verified_at,created_at,stripe_account_id) VALUES (?,?,?,?,?,?,?)',
    id, `${name}@t.dev`, name, 'x', NOW, NOW - ageDays * 86_400_000, `acct_${name}`,
  );
  return id;
}
const usd = async (id: string) => (await get<{ balance_usd: number }>('SELECT balance_usd FROM users WHERE id = ?', id))!.balance_usd;
const robux = async (id: string) => (await get<{ balance: number }>('SELECT balance FROM users WHERE id = ?', id))!.balance;

beforeEach(async () => {
  for (const t of ['reports', 'email_verifications', 'password_resets', 'rate_limits', 'reviews', 'messages', 'transactions', 'payment_requests', 'notifications', 'audit_log', 'orders', 'packages', 'creators', 'users']) {
    await run(`DELETE FROM ${t}`);
  }
  buyer = await mkUser('buyer');
  seller = await mkUser('seller');
  creatorId = uid();
  await run("INSERT INTO creators (id,user_id,slug,display_name,status,created_at) VALUES (?,?,?,?,'approved',?)", creatorId, seller, 'seller', 'Seller', NOW);
  usdPkg = uid();
  await run("INSERT INTO packages (id,creator_id,title,price,currency,delivery_days,revisions,created_at) VALUES (?,?,?,?,'USD',3,1,?)", usdPkg, creatorId, 'USD promo', 2000, NOW);
});

describe('USD escrow', () => {
  it('holds dollars, pays the creator minus the fee in dollars, and leaves Robux untouched', async () => {
    await postEntry(buyer, 5000, 'deposit', { currency: 'USD' });
    const id = await createOrder({ buyerId: buyer, packageId: usdPkg, gameName: 'Obby', gameUrl: 'https://roblox.com/games/1', brief: 'x' });
    expect(await usd(buyer)).toBe(3000);
    expect((await getOrder(id))!.currency).toBe('USD');
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await approveOrder(id, buyer);
    expect(await usd(seller)).toBe(1800); // 10% of $20.00 fee
    expect(await robux(seller)).toBe(0);
    expect(await robux(buyer)).toBe(0);
  });

  it('refuses a USD order when only Robux are available', async () => {
    await postEntry(buyer, 999_999, 'deposit'); // lots of Robux, no dollars
    await expect(createOrder({ buyerId: buyer, packageId: usdPkg, gameName: 'g', gameUrl: 'https://roblox.com/games/1', brief: '' })).rejects.toThrow(/Not enough USD/);
  });

  it('keeps the ledger consistent per currency', async () => {
    await postEntry(buyer, 5000, 'deposit', { currency: 'USD' });
    await postEntry(buyer, 700, 'deposit');
    const id = await createOrder({ buyerId: buyer, packageId: usdPkg, gameName: 'g', gameUrl: 'https://roblox.com/games/1', brief: '' });
    await acceptOrder(id, seller);
    await deliverOrder(id, seller, 'https://youtu.be/x', '');
    await approveOrder(id, buyer);
    for (const u of [buyer, seller]) {
      for (const cur of ['USD', 'ROBUX'] as const) {
        const sum = (await get<{ s: number }>('SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id = ? AND currency = ?', u, cur))!.s;
        expect(sum).toBe(cur === 'USD' ? await usd(u) : await robux(u));
      }
    }
  });
});

describe('Stripe', () => {
  const secret = 'whsec_test';
  const sign = (body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

  it('verifies webhook signatures and rejects tampering, replays and garbage', () => {
    const body = '{"id":"evt_1"}';
    expect(verifyWebhook(body, sign(body), secret)).toBe(true);
    expect(verifyWebhook(body + ' ', sign(body), secret)).toBe(false);
    expect(verifyWebhook(body, sign(body), 'other')).toBe(false);
    expect(verifyWebhook(body, sign(body, Math.floor(Date.now() / 1000) - 3600), secret)).toBe(false);
    expect(verifyWebhook(body, null, secret)).toBe(false);
    expect(verifyWebhook(body, 'garbage', secret)).toBe(false);
  });

  it('credits a card deposit exactly once even if the webhook is delivered repeatedly', async () => {
    const args = { sessionId: 'cs_test_1', paymentIntent: 'pi_1', userId: buyer, creditCents: 2500 };
    const results = await Promise.all([creditStripeDeposit(args), creditStripeDeposit(args), creditStripeDeposit(args)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await usd(buyer)).toBe(2500);
    expect(await creditStripeDeposit(args)).toBe(false);
    expect(await usd(buyer)).toBe(2500);
  });

  it('passes card fees to the buyer so the credited amount is exact', () => {
    const gross = grossForCredit(2500);
    const fee = Math.round(gross * 0.029 + 30);
    expect(gross - fee).toBeGreaterThanOrEqual(2499);
    expect(gross - fee).toBeLessThanOrEqual(2501);
  });

  it('encodes nested params the way Stripe expects', () => {
    const q = encodeForm({ mode: 'payment', line_items: [{ quantity: 1, price_data: { currency: 'usd' } }], metadata: { a: 1 } }).toString();
    expect(decodeURIComponent(q)).toBe('mode=payment&line_items[0][quantity]=1&line_items[0][price_data][currency]=usd&metadata[a]=1');
  });

  it('pauses payouts after a chargeback', async () => {
    await creditStripeDeposit({ sessionId: 'cs_2', paymentIntent: 'pi_2', userId: buyer, creditCents: 1000 });
    await flagChargeback('pi_2');
    const u = (await get<{ payout_hold: number; created_at: number; email_verified_at: number | null }>('SELECT payout_hold, created_at, email_verified_at FROM users WHERE id = ?', buyer))!;
    expect(u.payout_hold).toBe(1);
    await expect(assertCanWithdraw({ id: buyer, ...u })).rejects.toThrow(/paused/);
  });
});

describe('payout protection', () => {
  it('locks recent sale earnings for the chargeback window', async () => {
    await postEntry(seller, 10_000, 'deposit', { currency: 'USD' }); // old money
    await postEntry(seller, 4_000, 'sale', { currency: 'USD' }); // fresh earnings
    const { withdrawable, locked } = await withdrawableUsd(seller, 14_000);
    expect(locked).toBe(4_000);
    expect(withdrawable).toBe(10_000);
    await run("UPDATE transactions SET created_at = created_at - ? WHERE kind = 'sale'", 8 * 86_400_000);
    expect((await withdrawableUsd(seller, 14_000)).withdrawable).toBe(14_000);
  });

  it('blocks withdrawals for unverified email and brand-new accounts', async () => {
    await expect(assertCanWithdraw({ id: 'x', email_verified_at: null, created_at: NOW - 30 * 86_400_000 })).rejects.toThrow(/Verify your email/);
    await expect(assertCanWithdraw({ id: 'x', email_verified_at: NOW, created_at: NOW })).rejects.toThrow(/New accounts/);
    await expect(assertCanWithdraw({ id: 'x', email_verified_at: NOW, created_at: NOW - 30 * 86_400_000 })).resolves.toBeUndefined();
  });

  it('debits first, then keeps the request for an admin if Stripe cannot transfer', async () => {
    await postEntry(seller, 20_000, 'deposit', { currency: 'USD' });
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'insufficient funds' } }), { status: 400 })));
    const u = (await get<{ id: string; email_verified_at: number; created_at: number; balance_usd: number; stripe_account_id: string }>('SELECT * FROM users WHERE id = ?', seller))!;
    const r = await requestUsdWithdrawal(u, 5000);
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
    expect(r.status).toBe('pending');
    expect(await usd(seller)).toBe(15_000);
    const reqs = await all<{ status: string }>("SELECT status FROM payment_requests WHERE kind = 'withdrawal'");
    expect(reqs.map((x) => x.status)).toEqual(['pending']);
  });

  it('formats money', () => {
    expect(fmtMoney(1999, 'USD')).toBe('$19.99');
    expect(fmtMoney(2000, 'USD')).toBe('$20');
    expect(fmtMoney(1200, 'ROBUX')).toBe('R$ 1,200');
  });
});
