'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { run, tx, now, uid } from '@/lib/db';
import { AppError, audit, notify, notifyAdmins, postEntry } from '@/lib/ledger';
import { reviewCreator } from '@/lib/creators';
import { resolveDispute } from '@/lib/orders';
import { resolvePayment } from '@/lib/wallet';
import { fmtMoney, toUnits, type Currency } from '@/lib/money';
import { reportSchema, zodErrors } from '@/lib/validators';
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

/* ------------------------------------------------------------------ reports */

export async function submitReport(targetType: 'creator' | 'order' | 'user', targetId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = reportSchema.safeParse({ reason: str(fd, 'reason'), details: str(fd, 'details') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`report:${u.id}`, 6, 24 * 3_600_000))) return { error: 'You’ve sent several reports today. We’re looking into them.' };
  return wrap(async () => {
    await run(
      'INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, created_at) VALUES (?,?,?,?,?,?,?)',
      uid(), u.id, targetType, targetId, parsed.data.reason, parsed.data.details, now(),
    );
    await notifyAdmins('New report', `${parsed.data.reason.replace('_', ' ')} · ${targetType}`, '/admin/reports');
    return { ok: true, message: 'Thanks. Our team will review this report.' };
  });
}

/* -------------------------------------------------------------------- admin */

export async function adminReviewCreator(creatorId: string, decision: 'approve' | 'reject' | 'suspend' | 'reinstate', _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const note = str(fd, 'note').trim().slice(0, 400);
  if ((decision === 'reject' || decision === 'suspend') && !note) return { error: 'Add a short reason so the creator knows what happened.' };
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

export async function adminResolveReport(reportId: string, status: 'resolved' | 'dismissed', _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  return wrap(async () => {
    await run("UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND status = 'open'", status, str(fd, 'note').trim().slice(0, 300), a.id, now(), reportId);
    await audit(a.id, `report.${status}`, reportId);
  }, '/admin/reports');
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

export async function adminTogglePayoutHold(userId: string): Promise<ActionState> {
  const a = await requireAdmin();
  return wrap(async () => {
    await run('UPDATE users SET payout_hold = 1 - payout_hold WHERE id = ?', userId);
    await audit(a.id, 'user.payout_hold_toggle', userId);
  }, '/admin/users');
}

export async function adminVerifyEmail(userId: string): Promise<ActionState> {
  const a = await requireAdmin();
  return wrap(async () => {
    await run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', now(), userId);
    await audit(a.id, 'user.verify_email', userId);
  }, '/admin/users');
}

export async function adminAdjustBalance(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const currency: Currency = str(fd, 'currency') === 'USD' ? 'USD' : 'ROBUX';
  const amount = toUnits(Number(str(fd, 'amount')), currency);
  const note = str(fd, 'note').trim().slice(0, 200);
  if (!amount || !note) return { error: 'Enter a non-zero amount and a reason.' };
  return wrap(async () => {
    await tx(async () => {
      await postEntry(userId, amount, 'adjustment', { currency, note });
      await audit(a.id, 'user.adjust', userId, { amount, currency, note });
      await notify(userId, 'Balance adjusted', `${amount > 0 ? '+' : ''}${fmtMoney(amount, currency)} · ${note}`, '/app/wallet');
    });
    return { ok: true, message: 'Balance adjusted.' };
  }, '/admin/users');
}
