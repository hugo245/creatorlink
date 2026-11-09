'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { AppError } from '@/lib/ledger';
import { archivePackage, getCreatorByUser, getCreatorById, linkChannel, markVerified, saveCreatorDetails, savePackage, updateStats } from '@/lib/creators';
import { ChannelError, fetchTikTok, fetchYouTube, hasCode, parseTikTokUrl, parseYouTubeUrl } from '@/lib/channels';
import { assertEmailVerified } from '@/lib/identity';
import { toUnits } from '@/lib/money';
import { channelLinkSchema, creatorDetailsSchema, NICHES, packageSchema, zodErrors } from '@/lib/validators';
import { hit } from '@/lib/ratelimit';
import { run } from '@/lib/db';
import type { ActionState } from '@/components/form';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');

async function wrap(fn: () => Promise<ActionState | void | unknown>): Promise<ActionState> {
  try {
    const r = (await fn()) as ActionState | void;
    revalidatePath('/app/creator');
    revalidatePath('/app', 'layout');
    return r ?? { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    if (e instanceof ChannelError) return { error: e.message };
    throw e;
  }
}

/** Step 1: look up the channel from its link and attach it (unverified) to the user's creator profile. */
export async function linkChannelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = channelLinkSchema.safeParse({ platform: str(fd, 'platform'), url: str(fd, 'url') });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  if (!(await hit(`link:${u.id}`, 15, 60 * 60_000))) return { error: 'Too many attempts. Try again in a bit.' };
  const { platform, url } = parsed.data;
  return wrap(async () => {
    assertEmailVerified(u);
    if (platform === 'youtube') {
      const ref = parseYouTubeUrl(url);
      if (!ref) return { fields: { url: 'Use your channel link: youtube.com/@yourhandle or youtube.com/channel/UC…' } };
      try {
        await linkChannel(u.id, 'youtube', await fetchYouTube(url));
      } catch (e) {
        if (!(e instanceof ChannelError) || e.kind !== 'unavailable') throw e;
        await linkChannel(u.id, 'youtube', { manualRef: `${ref.kind}:${ref.value}`, url: `https://www.youtube.com/${ref.kind === 'handle' ? '@' : ref.kind === 'id' ? 'channel/' : 'user/'}${ref.value}` });
        return { ok: true, message: 'Channel saved. Automatic lookup is unavailable right now, so our team will verify it by hand.' };
      }
    } else {
      const handle = parseTikTokUrl(url);
      if (!handle) return { fields: { url: 'Use your profile link: tiktok.com/@yourhandle' } };
      try {
        await linkChannel(u.id, 'tiktok', await fetchTikTok(handle));
      } catch (e) {
        if (!(e instanceof ChannelError) || e.kind !== 'unavailable') throw e;
        await linkChannel(u.id, 'tiktok', { manualRef: handle, url: `https://www.tiktok.com/@${handle}` });
        return { ok: true, message: 'Profile saved. TikTok doesn’t let us read stats automatically, so our team will verify it by hand.' };
      }
    }
    return { ok: true, message: 'Channel found. Next, prove it’s yours.' };
  });
}

/** Step 2: read the channel back and look for the creator's one-time code. Only the owner can have put it there. */
export async function verifyChannelAction(platform: 'youtube' | 'tiktok'): Promise<ActionState> {
  const u = await requireUser();
  if (!(await hit(`verify:${u.id}`, 12, 60 * 60_000))) return { error: 'Too many attempts. Try again in a bit.' };
  return wrap(async () => {
    assertEmailVerified(u);
    const c = await getCreatorByUser(u.id);
    if (!c?.verification_code) throw new AppError('Link your channel first.');
    if (platform === 'youtube') {
      if (c.youtube_verified_at) return { ok: true, message: 'Already verified.' };
      if (!c.youtube_url) throw new AppError('Link your YouTube channel first.');
      let ch;
      try {
        ch = await fetchYouTube(c.youtube_url);
      } catch (e) {
        if (e instanceof ChannelError && e.kind === 'unavailable') throw new AppError('We can’t reach YouTube automatically right now. Our team will verify your channel by hand, usually within a day.');
        throw e;
      }
      if (!hasCode(ch.description, c.verification_code)) throw new AppError(`We couldn’t find ${c.verification_code} in your channel description yet. Save it in YouTube Studio, wait a minute, and try again.`);
      await markVerified(c.id, 'youtube', ch);
    } else {
      if (c.tiktok_verified_at) return { ok: true, message: 'Already verified.' };
      if (!c.tiktok_handle) throw new AppError('Link your TikTok profile first.');
      let p;
      try {
        p = await fetchTikTok(c.tiktok_handle.replace(/^ref:/, ''));
      } catch (e) {
        if (e instanceof ChannelError && e.kind === 'unavailable') throw new AppError('We can’t read TikTok automatically right now. Our team will verify your bio code by hand, usually within a day.');
        throw e;
      }
      if (!hasCode(p.description, c.verification_code)) throw new AppError(`We couldn’t find ${c.verification_code} in your TikTok bio yet. Save it, wait a minute, and try again.`);
      await markVerified(c.id, 'tiktok', p);
    }
    return { ok: true, message: 'Verified. Your channel is confirmed as yours.' };
  });
}

/** Re-read the live numbers for an already verified platform. */
export async function refreshStatsAction(platform: 'youtube' | 'tiktok'): Promise<ActionState> {
  const u = await requireUser();
  const c = await getCreatorByUser(u.id);
  if (!c) return { error: 'Link your channel first.' };
  if (!(await hit(`refresh:${c.id}:${platform}`, 2, 60 * 60_000))) return { error: 'Stats were just refreshed. Try again in an hour.' };
  return wrap(async () => {
    if (platform === 'youtube' && c.youtube_verified_at && c.youtube_url) await updateStats(c.id, 'youtube', await fetchYouTube(c.youtube_url));
    else if (platform === 'tiktok' && c.tiktok_verified_at && c.tiktok_handle) await updateStats(c.id, 'tiktok', await fetchTikTok(c.tiktok_handle));
    else throw new AppError('Verify this platform first.');
    return { ok: true, message: 'Stats updated.' };
  });
}

/** Step 3: headline, bio, genres. Name and numbers are not editable: they come from the verified channel. */
export async function saveDetailsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = creatorDetailsSchema.safeParse({
    headline: str(fd, 'headline'), bio: str(fd, 'bio'),
    niches: fd.getAll('niches').map(String).filter((n) => (NICHES as readonly string[]).includes(n)),
  });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  return wrap(async () => {
    await saveCreatorDetails(u.id, parsed.data);
    return { ok: true, message: 'Profile saved.' };
  });
}

export async function savePackageAction(packageId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id || u.creator_status === 'suspended') return { error: 'Creator profile required.' };
  const parsed = packageSchema.safeParse({
    title: str(fd, 'title'), description: str(fd, 'description'), currency: str(fd, 'currency'), price: str(fd, 'price'),
    deliveryDays: str(fd, 'deliveryDays'), revisions: str(fd, 'revisions'),
  });
  if (!parsed.success) return { fields: zodErrors(parsed.error) };
  const d = parsed.data;
  return wrap(async () => {
    await savePackage(u.creator_id!, packageId, { title: d.title, description: d.description, currency: d.currency, price: toUnits(d.price, d.currency), deliveryDays: d.deliveryDays, revisions: d.revisions });
    return { ok: true, message: packageId ? 'Package updated.' : 'Package added.' };
  });
}

export async function removePackage(packageId: string): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id) return { error: 'Creator profile required.' };
  return wrap(() => archivePackage(u.creator_id!, packageId));
}

export async function toggleListed(): Promise<ActionState> {
  const u = await requireUser();
  if (!u.creator_id) return { error: 'Creator profile required.' };
  return wrap(async () => {
    await run('UPDATE creators SET is_listed = 1 - is_listed WHERE id = ?', u.creator_id!);
  });
}

/** Admin: the creator's code was confirmed by eye on the channel (used when automatic lookup is unavailable). */
export async function adminVerifyPlatform(creatorId: string, platform: 'youtube' | 'tiktok'): Promise<ActionState> {
  const a = await requireAdmin();
  const c = await getCreatorById(creatorId);
  if (!c) return { error: 'Creator not found.' };
  return wrap(async () => {
    await markVerified(creatorId, platform, null, { adminId: a.id });
    revalidatePath('/admin/creators');
  });
}
