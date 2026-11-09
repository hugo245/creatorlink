import { NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/stripe';
import { creditStripeDeposit, flagChargeback } from '@/lib/wallet';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook: credits card deposits and reacts to chargebacks.
 * Configure the endpoint https://YOURDOMAIN/api/webhooks/stripe with events:
 *   checkout.session.completed, checkout.session.async_payment_succeeded, charge.dispute.created
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  const raw = await req.text(); // signature is computed over the exact raw body
  if (!verifyWebhook(raw, req.headers.get('stripe-signature'), secret)) return NextResponse.json({ error: 'Bad signature' }, { status: 400 });

  const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (obj.payment_status === 'paid' && meta.user_id && Number(meta.credit_cents) > 0) {
        await creditStripeDeposit({
          sessionId: String(obj.id),
          paymentIntent: obj.payment_intent ? String(obj.payment_intent) : null,
          userId: meta.user_id,
          creditCents: Number(meta.credit_cents),
        });
      }
    } else if (event.type === 'charge.dispute.created') {
      if (obj.payment_intent) await flagChargeback(String(obj.payment_intent));
    }
  } catch (e) {
    console.error('[stripe webhook] handler failed', event.id, e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 }); // Stripe will retry; credit is idempotent
  }
  return NextResponse.json({ received: true });
}
