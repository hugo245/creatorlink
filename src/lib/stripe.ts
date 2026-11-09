import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

/**
 * Minimal Stripe client over fetch (no SDK). Covers exactly what the app needs:
 *  - Checkout Sessions (USD deposits, credited by webhook)
 *  - Connect Express accounts + transfers (USD payouts to creators)
 *  - webhook signature verification
 */
const KEY = () => process.env.STRIPE_SECRET_KEY;
export const stripeConfigured = () => !!KEY();
export const webhookConfigured = () => !!process.env.STRIPE_WEBHOOK_SECRET;

export class StripeError extends Error {
  constructor(message: string, public status = 0, public code?: string) {
    super(message);
  }
}

/** Stripe wants form-encoded bodies with bracketed keys: a[b][0][c]=v */
export function encodeForm(params: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encodeForm(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') encodeForm(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function api<T>(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
  if (!KEY()) throw new StripeError('Card payments are not configured.');
  const headers: Record<string, string> = { Authorization: `Bearer ${KEY()}`, 'Stripe-Version': '2024-06-20' };
  let url = `https://api.stripe.com/v1${path}`;
  let body: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    body = encodeForm(params).toString();
  } else if (Object.keys(params).length) url += `?${encodeForm(params)}`;
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe error ${res.status}`, res.status, json.error?.code);
  return json;
}

/* ----------------------------------------------------------------- deposits */

/** What the buyer is charged so that `creditCents` lands in their wallet after card fees. */
export function grossForCredit(creditCents: number): number {
  const p = config.stripeFeePercent / 100;
  return Math.ceil((creditCents + config.stripeFeeFixedCents) / (1 - p));
}

export async function createDepositCheckout(opts: { userId: string; email: string; creditCents: number }) {
  const gross = grossForCredit(opts.creditCents);
  const session = await api<{ id: string; url: string }>('POST', '/checkout/sessions', {
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: opts.userId,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: gross,
        product_data: { name: `CreatorLink wallet deposit ($${(opts.creditCents / 100).toFixed(2)} credit + processing fee)` },
      },
    }],
    metadata: { user_id: opts.userId, credit_cents: opts.creditCents, gross_cents: gross },
    payment_intent_data: { metadata: { user_id: opts.userId, credit_cents: opts.creditCents } },
    success_url: `${config.appUrl}/app/wallet?deposit=success`,
    cancel_url: `${config.appUrl}/app/wallet?deposit=cancelled`,
  });
  return { url: session.url, id: session.id, gross };
}

/* ------------------------------------------------------------------ payouts */

export async function createConnectAccount(email: string, userId: string) {
  return api<{ id: string }>('POST', '/accounts', {
    type: 'express',
    email,
    capabilities: { transfers: { requested: true } },
    metadata: { user_id: userId },
  }, `acct-${userId}`);
}

export async function createAccountLink(accountId: string) {
  return api<{ url: string }>('POST', '/account_links', {
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${config.appUrl}/app/wallet?payouts=refresh`,
    return_url: `${config.appUrl}/app/wallet?payouts=return`,
  });
}

export async function getConnectAccount(accountId: string) {
  return api<{ id: string; payouts_enabled: boolean; details_submitted: boolean; capabilities?: { transfers?: string } }>('GET', `/accounts/${accountId}`);
}

export async function createTransfer(opts: { accountId: string; cents: number; idempotencyKey: string; description: string }) {
  return api<{ id: string }>('POST', '/transfers', {
    amount: opts.cents, currency: 'usd', destination: opts.accountId, description: opts.description,
  }, opts.idempotencyKey);
}

/* ----------------------------------------------------------------- webhooks */

/** Verifies the `Stripe-Signature` header (HMAC-SHA256 over `${t}.${body}`, 5 minute tolerance). */
export function verifyWebhook(rawBody: string, header: string | null, secret: string, nowMs = Date.now(), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(nowMs / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
