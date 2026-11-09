/**
 * Channel lookup and ownership proof.
 *
 * YouTube: official Data API v3 (needs YOUTUBE_API_KEY). Stats are exact: subscribers, total views, and the average
 *   views of the creator's recent uploads.
 * TikTok: there is no public stats API for third-party sites without per-user OAuth approval. We make a best-effort
 *   read of the public profile page; if TikTok blocks it, an admin verifies the bio code by hand.
 *
 * Ownership is proven by asking the creator to put a one-time code in their channel description / TikTok bio, then
 * reading it back from the platform. Only the real owner can edit that text.
 */

export class ChannelError extends Error {
  constructor(message: string, public kind: 'invalid' | 'not_found' | 'unavailable' = 'invalid') {
    super(message);
  }
}

export type YouTubeChannel = {
  id: string; title: string; handle: string | null; description: string; thumb: string | null;
  subs: number | null; totalViews: number; videoCount: number; avgViews: number | null; url: string;
};
export type TikTokProfile = {
  handle: string; title: string; description: string; followers: number; likes: number; videoCount: number; url: string;
};

/* ------------------------------------------------------------------ YouTube */

export type YouTubeRef = { kind: 'handle' | 'id' | 'user'; value: string };

export function parseYouTubeUrl(input: string): YouTubeRef | null {
  let u: URL;
  try {
    u = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host !== 'youtube.com') return null;
  const seg = u.pathname.split('/').filter(Boolean);
  if (seg[0]?.startsWith('@')) return { kind: 'handle', value: seg[0].slice(1) };
  if (seg[0] === 'channel' && /^UC[\w-]{22}$/.test(seg[1] ?? '')) return { kind: 'id', value: seg[1] };
  if (seg[0] === 'user' && seg[1]) return { kind: 'user', value: seg[1] };
  return null;
}

type YtList<T> = { items?: T[] };

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new ChannelError('Automatic YouTube lookup isn’t enabled on this server yet.', 'unavailable');
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`, { signal: AbortSignal.timeout(12_000), cache: 'no-store' });
  if (!res.ok) {
    console.error('[youtube] API error', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw new ChannelError('YouTube didn’t respond. Please try again in a minute.', 'unavailable');
  }
  return (await res.json()) as T;
}

export async function fetchYouTube(url: string): Promise<YouTubeChannel> {
  const ref = parseYouTubeUrl(url);
  if (!ref) throw new ChannelError('Use your channel link in the form youtube.com/@yourhandle or youtube.com/channel/UC…');
  const q: Record<string, string> = { part: 'snippet,statistics,contentDetails' };
  if (ref.kind === 'handle') q.forHandle = `@${ref.value}`;
  else if (ref.kind === 'id') q.id = ref.value;
  else q.forUsername = ref.value;

  type Ch = {
    id: string;
    snippet: { title: string; description: string; customUrl?: string; thumbnails?: Record<string, { url: string }> };
    statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
    contentDetails: { relatedPlaylists: { uploads: string } };
  };
  const data = await yt<YtList<Ch>>('channels', q);
  const ch = data.items?.[0];
  if (!ch) throw new ChannelError('We couldn’t find that YouTube channel. Check the link.', 'not_found');

  // Average views over recent uploads. Skip the newest few days (they haven't accumulated views yet).
  let avgViews: number | null = null;
  try {
    const pl = await yt<YtList<{ contentDetails: { videoId: string; videoPublishedAt?: string } }>>('playlistItems', {
      part: 'contentDetails', playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: '20',
    });
    const cutoff = Date.now() - 3 * 86_400_000;
    let ids = (pl.items ?? []).filter((i) => !i.contentDetails.videoPublishedAt || Date.parse(i.contentDetails.videoPublishedAt) < cutoff).map((i) => i.contentDetails.videoId);
    if (ids.length < 3) ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
    ids = ids.slice(0, 10);
    if (ids.length) {
      const vids = await yt<YtList<{ statistics: { viewCount?: string } }>>('videos', { part: 'statistics', id: ids.join(',') });
      const views = (vids.items ?? []).map((v) => Number(v.statistics.viewCount)).filter((n) => Number.isFinite(n));
      if (views.length) avgViews = Math.round(views.reduce((a, b) => a + b, 0) / views.length);
    }
  } catch (e) {
    if (!(e instanceof ChannelError)) throw e; // stats are best-effort; ownership check doesn't depend on them
  }

  const th = ch.snippet.thumbnails;
  return {
    id: ch.id,
    title: ch.snippet.title,
    handle: ch.snippet.customUrl?.replace(/^@/, '') ?? null,
    description: ch.snippet.description ?? '',
    thumb: th?.medium?.url ?? th?.default?.url ?? null,
    subs: ch.statistics.hiddenSubscriberCount ? null : Number(ch.statistics.subscriberCount ?? 0),
    totalViews: Number(ch.statistics.viewCount ?? 0),
    videoCount: Number(ch.statistics.videoCount ?? 0),
    avgViews,
    url: `https://www.youtube.com/channel/${ch.id}`,
  };
}

/* ------------------------------------------------------------------- TikTok */

export function parseTikTokUrl(input: string): string | null {
  const raw = input.trim();
  if (/^@?[A-Za-z0-9._]{2,24}$/.test(raw)) return raw.replace(/^@/, '').toLowerCase();
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (u.hostname.replace(/^www\.|^m\./, '') !== 'tiktok.com') return null;
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg?.startsWith('@') && /^@[A-Za-z0-9._]{2,24}$/.test(seg) ? seg.slice(1).toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Pulls the profile JSON TikTok embeds in its public page. Fragile by nature, so every failure is "unavailable". */
export async function fetchTikTok(handle: string): Promise<TikTokProfile> {
  let html: string;
  try {
    const res = await fetch(`https://www.tiktok.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(12_000), cache: 'no-store',
    });
    if (res.status === 404) throw new ChannelError('We couldn’t find that TikTok account. Check the link.', 'not_found');
    if (!res.ok) throw new ChannelError('TikTok didn’t let us read that profile automatically.', 'unavailable');
    html = await res.text();
  } catch (e) {
    if (e instanceof ChannelError) throw e;
    throw new ChannelError('TikTok didn’t let us read that profile automatically.', 'unavailable');
  }
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new ChannelError('TikTok didn’t let us read that profile automatically.', 'unavailable');
  try {
    const scope = JSON.parse(m[1]).__DEFAULT_SCOPE__?.['webapp.user-detail'];
    if (scope?.statusCode === 10221 || scope?.statusCode === 10202) throw new ChannelError('We couldn’t find that TikTok account. Check the link.', 'not_found');
    const info = scope?.userInfo;
    if (!info?.user) throw new Error('shape');
    return {
      handle: String(info.user.uniqueId).toLowerCase(),
      title: String(info.user.nickname ?? info.user.uniqueId),
      description: String(info.user.signature ?? ''),
      followers: Number(info.stats?.followerCount ?? 0),
      likes: Number(info.stats?.heartCount ?? 0),
      videoCount: Number(info.stats?.videoCount ?? 0),
      url: `https://www.tiktok.com/@${info.user.uniqueId}`,
    };
  } catch (e) {
    if (e instanceof ChannelError) throw e;
    throw new ChannelError('TikTok didn’t let us read that profile automatically.', 'unavailable');
  }
}

/** True if the platform text contains the creator's one-time code. */
export const hasCode = (text: string, code: string) => !!code && text.toUpperCase().includes(code.toUpperCase());
