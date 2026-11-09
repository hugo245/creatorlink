'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { AppError } from '@/lib/ledger';
import { toUnits } from '@/lib/money';
import { assertEmailVerified } from '@/lib/identity';
import { depositSchema, usdDepositSchema, usdWithdrawSchema, withdrawSchema, zodErrors } from '@/lib/validators';
import { hit } from '@/lib/ratelimit';
import { addTestFunds, requestDeposit, requestUsdWithdrawal, requestWithdrawal } from '@/lib/wallet';
import { createAccountLink, createConnectAccount, createDepositCheckout, getConnectAccount, stripeConfigured } from '@/lib/stripe';
import { run } from '@/lib/db';
import type { ActionState } from '@/components/form';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

async function guarded<T extends ActionState | void>(fn: () => Promise<T>): Promise<ActionState> {
  try {
    const r = await fn();
    revalidatePath('/app', 'layout');
    return (r as ActionState) ?? { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    // redirect() throws a special error that must propagate
    throw e;
  }
}

export async function topUpTestFunds(): Promise<ActionState> {
  const u = await requireUser();
  return guarded(async () => {
    await addTestFunds(u.id);
    return { ok: true, message: 'Added R$ 5,000 and $50 of test funds.' };
  });
}

/* ------------------------------------------------------------ Robux (manual) */

export async function submitDeposit(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = depositSchema.safeParse({ amount: str(fd, 'amount'), reference: str(fd, 'reference') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return guarded(async () => {
    assertEmailVerified(u);
    await requestDeposit(u.id, parsed.data.amount, parsed.data.reference);
    return { ok: true, message: 'Deposit submitted. We’ll credit your balance once it’s confirmed.' };
  });
}

export async function submitWithdrawal(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = withdrawSchema.safeParse({ amount: str(fd, 'amount'), gamepass: str(fd, 'gamepass') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`wd:${u.id}`, 5, 60 * 60_000))) return { error: 'Too many withdrawal requests. Try again later.' };
  return guarded(async () => {
    await requestWithdrawal(u, parsed.data.amount, parsed.data.gamepass);
    return { ok: true, message: 'Withdrawal requested. It’s usually processed within 24 hours.' };
  });
}

/* --------------------------------------------------------------- USD (cards) */

export async function startUsdDeposit(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = usdDepositSchema.safeParse({ amount: str(fd, 'amount') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!stripeConfigured()) return { error: 'Card payments aren’t available yet.' };
  if (!(await hit(`usd-dep:${u.id}`, 10, 60 * 60_000))) return { error: 'Too many attempts. Try again later.' };
  let url: string;
  try {
    assertEmailVerified(u);
    const credit = toUnits(parsed.data.amount, 'USD');
    ({ url } = await createDepositCheckout({ userId: u.id, email: u.email, creditCents: credit }));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[stripe] checkout failed', e);
    return { error: 'We couldn’t start the payment. Please try again.' };
  }
  redirect(url);
}

export async function setupPayouts(): Promise<ActionState> {
  const u = await requireUser();
  if (!stripeConfigured()) return { error: 'Payouts aren’t available yet.' };
  let url: string;
  try {
    assertEmailVerified(u);
    let acct = u.stripe_account_id;
    if (!acct) {
      acct = (await createConnectAccount(u.email, u.id)).id;
      await run('UPDATE users SET stripe_account_id = ? WHERE id = ?', acct, u.id);
    }
    url = (await createAccountLink(acct)).url;
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error('[stripe] connect onboarding failed', e);
    return { error: 'We couldn’t open payout setup. Please try again.' };
  }
  redirect(url);
}

export async function submitUsdWithdrawal(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = usdWithdrawSchema.safeParse({ amount: str(fd, 'amount') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`wd:${u.id}`, 5, 60 * 60_000))) return { error: 'Too many withdrawal requests. Try again later.' };
  if (!stripeConfigured()) return { error: 'Payouts aren’t available yet.' };
  return guarded(async () => {
    if (!u.stripe_account_id) throw new AppError('Set up payouts first.');
    const acct = await getConnectAccount(u.stripe_account_id).catch(() => null);
    if (!acct?.payouts_enabled) throw new AppError('Finish payout setup with Stripe before withdrawing.');
    const r = await requestUsdWithdrawal(u, toUnits(parsed.data.amount, 'USD'));
    return {
      ok: true,
      message: r.status === 'completed' ? 'Payout sent. It usually reaches your bank in 1–3 business days.' : 'Withdrawal requested. We’ll send it shortly.',
    };
  });
}
