'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { get, run, now, uid } from '@/lib/db';
import { AppError } from '@/lib/ledger';
import * as orders from '@/lib/orders';
import { deliverSchema, orderSchema, reasonSchema, reviewSchema, zodErrors } from '@/lib/validators';
import { hit } from '@/lib/ratelimit';
import { saveUpload } from '@/lib/storage';
import type { ActionState } from '@/components/form';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

/** Run a state transition and turn AppErrors into form feedback. */
async function guard(path: string, fn: () => void, message: string): Promise<ActionState> {
  try {
    fn();
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath(path);
  revalidatePath('/app', 'layout');
  return { ok: true, message };
}

export async function placeOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const raw = { packageId: str(fd, 'packageId'), gameName: str(fd, 'gameName'), gameUrl: str(fd, 'gameUrl'), brief: str(fd, 'brief') };
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) return { fields: zodErrors(parsed.error), values: raw };
  if (!hit(`order:${user.id}`, 10, 60 * 60_000)) return { error: 'You are placing orders too quickly. Try again in a bit.', values: raw };
  let id: string;
  try {
    id = orders.createOrder({ buyerId: user.id, ...parsed.data });
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, values: raw };
    throw e;
  }
  revalidatePath('/app', 'layout');
  redirect(`/app/orders/${id}?placed=1`);
}

export async function acceptOrder(orderId: string): Promise<ActionState> {
  const u = await requireUser();
  return guard(`/app/orders/${orderId}`, () => orders.acceptOrder(orderId, u.id), 'Order accepted.');
}

export async function declineOrder(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  return guard(`/app/orders/${orderId}`, () => orders.declineOrder(orderId, u.id, str(fd, 'reason').trim().slice(0, 300)), 'Order declined.');
}

export async function deliverOrder(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = deliverSchema.safeParse({ url: str(fd, 'url'), note: str(fd, 'note') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return guard(`/app/orders/${orderId}`, () => orders.deliverOrder(orderId, u.id, parsed.data.url, parsed.data.note), 'Delivery submitted.');
}

export async function cancelOrder(orderId: string): Promise<ActionState> {
  const u = await requireUser();
  return guard(`/app/orders/${orderId}`, () => orders.cancelOrder(orderId, u.id), 'Order cancelled and refunded.');
}

export async function approveOrder(orderId: string): Promise<ActionState> {
  const u = await requireUser();
  return guard(`/app/orders/${orderId}`, () => orders.approveOrder(orderId, u.id), 'Funds released.');
}

export async function requestRevision(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = reasonSchema('Feedback').safeParse(str(fd, 'message'));
  if (!parsed.success) return { fields: { message: parsed.error.issues[0].message } };
  return guard(`/app/orders/${orderId}`, () => orders.requestRevision(orderId, u.id, parsed.data), 'Revision requested.');
}

export async function openDispute(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = reasonSchema('Reason').safeParse(str(fd, 'reason'));
  if (!parsed.success) return { fields: { reason: parsed.error.issues[0].message } };
  return guard(`/app/orders/${orderId}`, () => orders.openDispute(orderId, u.id, parsed.data), 'Dispute opened. Support will review it.');
}

export async function leaveReview(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = reviewSchema.safeParse({ rating: str(fd, 'rating'), body: str(fd, 'body') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return guard(`/app/orders/${orderId}`, () => orders.addReview(orderId, u.id, parsed.data.rating, parsed.data.body), 'Thanks for your review.');
}

/* --------------------------------------------------------------------- chat */

export async function sendMessage(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const o = orders.getOrder(orderId);
  if (!o || (o.buyer_id !== u.id && o.seller_user_id !== u.id && u.role !== 'admin')) return { error: 'Conversation not found.' };
  if (['completed', 'cancelled', 'declined', 'refunded'].includes(o.status) && now() - (o.completed_at ?? o.updated_at) > 7 * 86_400_000) {
    return { error: 'This conversation is closed.' };
  }
  const body = str(fd, 'body').trim().slice(0, 2000);
  const file = fd.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (!body && !hasFile) return { error: 'Write a message or attach a file.' };
  if (!hit(`msg:${u.id}`, 40, 60_000)) return { error: 'Slow down a little.' };

  let att: { path: string; mime: string } | null = null;
  if (hasFile) {
    try {
      att = await saveUpload(file, `chat/${orderId}`);
    } catch (e) {
      if (e instanceof AppError) return { error: e.message };
      throw e;
    }
  }
  run(
    "INSERT INTO messages (id, order_id, sender_id, kind, body, file_path, file_name, file_type, created_at) VALUES (?,?,?,'user',?,?,?,?,?)",
    uid(), orderId, u.id, body, att?.path ?? null, hasFile ? (file as File).name.slice(0, 120) : null, att?.mime ?? null, now(),
  );
  const other = u.id === o.buyer_id ? o.seller_user_id : o.buyer_id;
  // Collapse repeated message pings: only one unread "new message" per order.
  const exists = get(
    "SELECT 1 FROM notifications WHERE user_id = ? AND read_at IS NULL AND href = ? AND title = 'New message'",
    other, `/app/orders/${orderId}`,
  );
  if (!exists && other !== u.id) {
    run(
      "INSERT INTO notifications (id, user_id, title, body, href, created_at) VALUES (?,?,'New message',?,?,?)",
      uid(), other, `${u.username}: ${(body || 'Sent a file').slice(0, 80)}`, `/app/orders/${orderId}`, now(),
    );
  }
  return { ok: true };
}
