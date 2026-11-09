'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { run, tx } from '@/lib/db';
import { AppError, audit, notify, postEntry } from '@/lib/ledger';
import { archivePackage, reviewCreator, saveCreatorProfile, savePackage } from '@/lib/creators';
import { resolveDispute } from '@/lib/orders';
import { addTestFunds, requestDeposit, requestWithdrawal, resolvePayment } from '@/lib/wallet';
import { creatorApplySchema, depositSchema, NICHES, packageSchema, withdrawSchema, zodErrors } from '@/lib/validators';
import { hit } from '@/lib/ratelimit';
import type { ActionState } from '@/components/form';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

async function wrap(fn: () => Promise<ActionState | void | unknown>, path?: string): Promise<ActionState> {
  try {
    const r = (await fn()) as ActionState | void;
    if (path) revalidatePath(path);
    revalidatePath('/app', 'layout');
    return r ?? { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

/* ------------------------------------------------------------------- wallet */

export async function topUpTestFunds(): Promise<ActionState> {
  const u = await requireUser();
  return wrap(async () => {
    await addTestFunds(u.id, 5000);
    return { ok: true, message: 'Added R$ 5,000 of test funds.' };
  }, '/app/wallet');
}

export async function submitDeposit(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = depositSchema.safeParse({ amount: str(fd, 'amount'), reference: str(fd, 'reference') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return wrap(async () => {
    await requestDeposit(u.id, parsed.data.amount, parsed.data.reference);
    return { ok: true, message: 'Deposit submitted. We’ll credit your balance once it’s confirmed.' };
  }, '/app/wallet');
}

export async function submitWithdrawal(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = withdrawSchema.safeParse({ amount: str(fd, 'amount'), gamepass: str(fd, 'gamepass') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`wd:${u.id}`, 5, 60 * 60_000))) return { error: 'Too many withdrawal requests. Try again later.' };
  return wrap(async () => {
    await requestWithdrawal(u.id, parsed.data.amount, parsed.data.gamepass);
    return { ok: true, message: 'Withdrawal requested. It’s usually processed within 24 hours.' };
  }, '/app/wallet');
}

/* ------------------------------------------------------------ notifications */

export async function markAllRead() {
  const u = await requireUser();
  await run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', Date.now(), u.id);
  revalidatePath('/app', 'layout');
}

export async function markRead(id: string) {
  const u = await requireUser();
  await run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', Date.now(), id, u.id);
  revalidatePath('/app', 'layout');
}

/* ------------------------------------------------------------------ creator */

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const raw = {
    displayName: str(fd, 'displayName'), platform: str(fd, 'platform'), youtubeUrl: str(fd, 'youtubeUrl'), tiktokUrl: str(fd, 'tiktokUrl'),
    followers: str(fd, 'followers'), avgViews: str(fd, 'avgViews'), headline: str(fd, 'headline'), bio: str(fd, 'bio'),
    niches: fd.getAll('niches').map(String).filter((n) => (NICHES as readonly string[]).includes(n)),
  };
  const parsed = creatorApplySchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return wrap(async () => {
    const r = await saveCreatorProfile(u.id, parsed.data);
    return {
      ok: true,
      message: r.created ? 'Application submitted. We review every creator by hand, usually within a day.' : 'Profile saved.',
    };
  }, '/app/creator');
}

export async function savePackageAction(packageId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id || u.creator_status === 'suspended') return { error: 'Creator profile required.' };
  const parsed = packageSchema.safeParse({
    title: str(fd, 'title'), description: str(fd, 'description'), price: str(fd, 'price'),
    deliveryDays: str(fd, 'deliveryDays'), revisions: str(fd, 'revisions'),
  });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return wrap(async () => {
    await savePackage(u.creator_id!, packageId, parsed.data);
    return { ok: true, message: packageId ? 'Package updated.' : 'Package added.' };
  }, '/app/creator');
}

export async function removePackage(packageId: string): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id) return { error: 'Creator profile required.' };
  return wrap(() => archivePackage(u.creator_id!, packageId), '/app/creator');
}

export async function toggleListed(): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id) return { error: 'Creator profile required.' };
  return wrap(async () => {
    await run('UPDATE creators SET is_listed = 1 - is_listed WHERE id = ?', u.creator_id!);
  }, '/app/creator');
}

/* -------------------------------------------------------------------- admin */

export async function adminReviewCreator(creatorId: string, decision: 'approve' | 'reject' | 'suspend' | 'reinstate', _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const note = str(fd, 'note').trim().slice(0, 400);
  if (decision === 'reject' && !note) return { error: 'Add a short reason so the creator knows what to fix.' };
  return wrap(() => reviewCreator(a.id, creatorId, decision, note), '/admin/creators');
}

export async function adminResolveDispute(orderId: string, outcome: 'release' | 'refund', _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const note = str(fd, 'note').trim().slice(0, 400);
  if (!note) return { error: 'Add a note explaining the decision. Both parties will see it.' };
  return wrap(() => resolveDispute(orderId, a.id, outcome, note), '/admin/disputes');
}

export async function adminResolvePayment(requestId: string, approve: boolean, _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  return wrap(() => resolvePayment(a.id, requestId, approve, str(fd, 'note').trim().slice(0, 200)), '/admin/payments');
}

export async function adminSetBan(userId: string, ban: boolean): Promise<ActionState> {
  const a = await requireAdmin();
  if (userId === a.id) return { error: "You can't suspend yourself." };
  return wrap(async () => {
    await tx(async () => {
      await run('UPDATE users SET banned_at = ? WHERE id = ?', ban ? Date.now() : null, userId);
      if (ban) await run('DELETE FROM sessions WHERE user_id = ?', userId);
      await audit(a.id, ban ? 'user.ban' : 'user.unban', userId);
    });
  }, '/admin/users');
}

export async function adminAdjustBalance(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const amount = Math.trunc(Number(str(fd, 'amount')));
  const note = str(fd, 'note').trim().slice(0, 200);
  if (!amount || !note) return { error: 'Enter a non-zero amount and a reason.' };
  return wrap(async () => {
    await tx(async () => {
      await postEntry(userId, amount, 'adjustment', { note });
      await audit(a.id, 'user.adjust', userId, { amount, note });
      await notify(userId, 'Balance adjusted', `${amount > 0 ? '+' : ''}${amount.toLocaleString('en-US')} R$ · ${note}`, '/app/wallet');
    });
    return { ok: true, message: 'Balance adjusted.' };
  }, '/admin/users');
}
