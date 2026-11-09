import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, run, uid } from '@/lib/db';
import { checkUsername, creatorSkeleton, nameFlags, similarCreators, skeleton } from '@/lib/identity';
import { flagMessage } from '@/lib/safety';
import { fetchTikTok, fetchYouTube, hasCode, parseTikTokUrl, parseYouTubeUrl } from '@/lib/channels';
import { getCreatorByUser, linkChannel, markVerified, reviewCreator } from '@/lib/creators';

describe('impersonation protection', () => {
  it('collapses look-alike characters, case, separators and repeats', () => {
    const base = skeleton('KaiPlays');
    for (const v of ['kaiplays', 'KAI_PLAYS', 'K4iPl4ys', 'Kai.Plays', 'KaIIPlays', 'kaiplaaays', 'Kai_Pl@y$']) expect(skeleton(v)).toBe(base);
    expect(skeleton('KaiPlays2')).not.toBe(base); // two real users can be john1 and john2
    expect(creatorSkeleton('KaiPlays2')).toBe(base); // but for creator names, a trailing number is a copycat trick
    expect(creatorSkeleton('Kai Plays _')).toBe(base);
    expect(skeleton('Kai Plays')).not.toBe(skeleton('KaiPlayz'));
    expect(skeleton('Voltage')).toBe(skeleton('V0ltage'));
  });

  it('rejects usernames that imitate staff or the brand, and weird/abusive ones', () => {
    for (const bad of ['admin', 'Adm1n', 'creatorlink', 'CreatorL1nk_support', 'official_roblox', 'R0blox_Staff', 'support', 'a_', '__ab', 'a', 'x'.repeat(25), 'has space', 'aaaaaa1', 'sh1t_head', '123456'])
      expect(checkUsername(bad), bad).not.toBeNull();
    for (const ok of ['kai_plays', 'MaraQuest', 'builder_99', 'Pixel_Pip']) expect(checkUsername(ok), ok).toBeNull();
  });

  it('flags creator names containing reserved or offensive words', () => {
    expect(nameFlags('CreatorLink Official')).toHaveLength(1);
    expect(nameFlags('Normal Channel')).toHaveLength(0);
  });

  it('flags chat that tries to leave the platform or phish credentials', () => {
    for (const bad of ['pay me on paypal instead', 'join my discord.gg/abc123', 'send your roblox password', 'text me on whatsapp', 'send btc please']) expect(flagMessage(bad), bad).toBe(true);
    for (const ok of ['video is up, let me know', 'can you change the hook?', 'thanks!']) expect(flagMessage(ok), ok).toBe(false);
  });
});

describe('channel parsing', () => {
  it('parses supported YouTube links and rejects the rest', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/@KaiPlays')).toEqual({ kind: 'handle', value: 'KaiPlays' });
    expect(parseYouTubeUrl('youtube.com/channel/UCabcdefghijklmnopqrstuv')).toEqual({ kind: 'id', value: 'UCabcdefghijklmnopqrstuv' });
    expect(parseYouTubeUrl('https://evil.com/@KaiPlays')).toBeNull();
    expect(parseYouTubeUrl('https://youtube.com/watch?v=abc')).toBeNull();
    expect(parseYouTubeUrl('nonsense')).toBeNull();
  });
  it('parses TikTok handles', () => {
    expect(parseTikTokUrl('https://www.tiktok.com/@Kai.Plays')).toBe('kai.plays');
    expect(parseTikTokUrl('@kai')).toBe('kai');
    expect(parseTikTokUrl('https://evil.com/@kai')).toBeNull();
  });
  it('finds the verification code case-insensitively', () => {
    expect(hasCode('hello cl-abcd1234 world', 'CL-ABCD1234')).toBe(true);
    expect(hasCode('nothing here', 'CL-ABCD1234')).toBe(false);
    expect(hasCode('x', '')).toBe(false);
  });
});

describe('YouTube lookup and ownership verification', () => {
  const channel = (description: string) => ({
    items: [{ id: 'UCabcdefghijklmnopqrstuv', snippet: { title: 'Kai Plays', description, customUrl: '@kaiplays', thumbnails: { medium: { url: 'https://img/x.jpg' } } },
      statistics: { subscriberCount: '120000', viewCount: '9000000', videoCount: '300' }, contentDetails: { relatedPlaylists: { uploads: 'UUx' } } }],
  });
  const stub = (description: string) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/channels')) return new Response(JSON.stringify(channel(description)));
      if (u.includes('/playlistItems')) return new Response(JSON.stringify({ items: ['a', 'b', 'c', 'd'].map((id) => ({ contentDetails: { videoId: id, videoPublishedAt: '2024-01-01T00:00:00Z' } })) }));
      return new Response(JSON.stringify({ items: [{ statistics: { viewCount: '1000' } }, { statistics: { viewCount: '3000' } }, { statistics: { viewCount: '2000' } }] }));
    }));

  let userA: string, userB: string;
  beforeEach(async () => {
    process.env.YOUTUBE_API_KEY = 'test';
    for (const t of ['reports', 'reviews', 'messages', 'transactions', 'notifications', 'audit_log', 'orders', 'packages', 'creators', 'users']) await run(`DELETE FROM ${t}`);
    userA = uid(); userB = uid();
    for (const [id, n] of [[userA, 'alice'], [userB, 'bob']]) await run('INSERT INTO users (id,email,username,password_hash,email_verified_at,created_at) VALUES (?,?,?,?,?,?)', id, `${n}@t.dev`, n, 'x', Date.now(), Date.now());
  });

  it('reads real stats from the API response and computes the average views', async () => {
    stub('');
    const ch = await fetchYouTube('https://youtube.com/@kaiplays');
    vi.unstubAllGlobals();
    expect(ch).toMatchObject({ title: 'Kai Plays', subs: 120000, totalViews: 9_000_000, videoCount: 300, avgViews: 2000 });
  });

  it('links, verifies via the code, and fills stats and the public name from the channel', async () => {
    stub('Welcome! CL-TEST1234');
    await linkChannel(userA, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    const c = (await getCreatorByUser(userA))!;
    expect(c.display_name).toBe('Kai Plays');
    expect(c.verified).toBe(false);
    expect(c.status).toBe('pending');
    expect(c.followers).toBe(0); // unverified numbers are never shown as the headline audience
    await markVerified(c.id, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    vi.unstubAllGlobals();
    const v = (await getCreatorByUser(userA))!;
    expect(v.verified).toBe(true);
    expect(v.followers).toBe(120000);
    expect(v.avg_views).toBe(2000);
  });

  it('refuses to link a channel that another account already owns', async () => {
    stub('');
    await linkChannel(userA, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    await expect(linkChannel(userB, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'))).rejects.toThrow(/already linked/);
    vi.unstubAllGlobals();
  });

  it('cannot be approved until ownership is verified', async () => {
    stub('');
    await linkChannel(userA, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    const c = (await getCreatorByUser(userA))!;
    await expect(reviewCreator(userB, c.id, 'approve', '')).rejects.toThrow(/isn’t verified/);
    await markVerified(c.id, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    vi.unstubAllGlobals();
    await reviewCreator(userB, c.id, 'approve', '');
    expect((await getCreatorByUser(userA))!.status).toBe('approved');
  });

  it('flags a new channel whose name copies an approved creator', async () => {
    stub('');
    await linkChannel(userA, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    const a = (await getCreatorByUser(userA))!;
    await markVerified(a.id, 'youtube', await fetchYouTube('https://youtube.com/@kaiplays'));
    await reviewCreator(userB, a.id, 'approve', '');
    expect(await similarCreators('K4i_Plays')).toEqual(['Kai Plays']);
    vi.unstubAllGlobals();
  });

  it('degrades gracefully when the API key is missing or TikTok blocks the read', async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchYouTube('https://youtube.com/@kaiplays')).rejects.toMatchObject({ kind: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>blocked</html>')));
    await expect(fetchTikTok('kai')).rejects.toMatchObject({ kind: 'unavailable' });
    vi.unstubAllGlobals();
  });

  it('parses the profile JSON TikTok embeds in its page', async () => {
    const data = { __DEFAULT_SCOPE__: { 'webapp.user-detail': { userInfo: { user: { uniqueId: 'kai', nickname: 'Kai', signature: 'bio CL-ABCD1234' }, stats: { followerCount: 5000, heartCount: 90000, videoCount: 40 } } } } };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script>`)));
    const p = await fetchTikTok('kai');
    vi.unstubAllGlobals();
    expect(p).toMatchObject({ handle: 'kai', followers: 5000, likes: 90000, videoCount: 40 });
    expect(hasCode(p.description, 'CL-ABCD1234')).toBe(true);
    void get;
  });
});
