/**
 * Demo data for local development: `npm run seed` (add `-- --reset` to wipe first).
 * All accounts and creators below are fictional. Never run against production.
 */
import { all, get, run, now, uid } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { postEntry } from '../src/lib/ledger';
import { acceptOrder, addReview, approveOrder, createOrder, deliverOrder, openDispute } from '../src/lib/orders';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production.');

if (process.argv.includes('--reset')) {
  for (const t of ['reviews', 'messages', 'transactions', 'payment_requests', 'notifications', 'audit_log', 'orders', 'packages', 'creators', 'sessions', 'users']) {
    run(`DELETE FROM ${t}`);
  }
}
if (get('SELECT 1 FROM users LIMIT 1')) {
  console.log('Database already has users — skipping seed (use --reset to wipe).');
  process.exit(0);
}

const pw = await hashPassword('demo1234');
const day = 86_400_000;

function user(username: string, email: string, role = 'user') {
  const id = uid();
  run('INSERT INTO users (id,email,username,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', id, email, username, pw, role, now() - 30 * day);
  return id;
}

user('admin', 'admin@creatorlink.local', 'admin');
const dev = user('demo_dev', 'dev@creatorlink.local');
postEntry(dev, 25_000, 'test_deposit', { note: 'Demo funds' });

type Seed = {
  name: string; platform: 'youtube' | 'tiktok' | 'both'; followers: number; views: number; headline: string; bio: string; niches: string[];
  packages: [string, string, number, number, number][];
};

const CREATORS: Seed[] = [
  { name: 'Kai Plays', platform: 'tiktok', followers: 412_000, views: 180_000, headline: 'Fast, punchy 60-second gameplay shorts that convert to joins.', niches: ['Simulator', 'Obby', 'Tycoon'],
    bio: 'I make short, loud, high-retention Roblox clips for a mostly 10–16 audience. I play your game properly before filming, hook in the first second, and always put your game name on screen. Past work includes simulators and obbies.',
    packages: [['60s gameplay short', 'One TikTok, hook-first edit, game name + link in the caption.', 1200, 3, 1], ['3-video series', 'Three shorts over one week with different hooks.', 3000, 7, 2]] },
  { name: 'Mara Quest', platform: 'youtube', followers: 186_000, views: 62_000, headline: 'Long-form first-look videos for RPGs and story games.', niches: ['RPG', 'Story', 'Anime'],
    bio: 'Ten-minute honest first-impressions, with chapters and a pinned link to your game. I’ll tell my audience what’s good and what’s rough — viewers trust that. Best for games with depth.',
    packages: [['First-look video (8–12 min)', 'Honest playthrough with pinned link and description credit.', 4500, 7, 1], ['Dedicated review + Short', 'Full video plus a vertical Short cut.', 6500, 10, 1]] },
  { name: 'Voltage', platform: 'both', followers: 940_000, views: 410_000, headline: 'Big-channel promos for tycoons and simulators. Booked weeks ahead.', niches: ['Tycoon', 'Simulator', 'Sandbox'],
    bio: 'Roughly a million followers across both platforms. I accept a limited number of promotions per month and only for games I’d play myself. Cross-posted to YouTube and TikTok.',
    packages: [['Cross-platform promo', 'One YouTube video and one TikTok, same week.', 18_000, 10, 1], ['Featured placement', 'Mention + pinned comment in a regular upload.', 9000, 7, 0]] },
  { name: 'Nightowl Plays', platform: 'youtube', followers: 73_000, views: 21_000, headline: 'Horror and survival specialist. Atmospheric, well-edited.', niches: ['Horror', 'Survival'],
    bio: 'Horror is all I do. Moody edits, good audio, decent jump-scare timing. If your game is scary, my audience will find it.',
    packages: [['Horror playthrough', '10-minute edited playthrough with link in the description.', 2200, 5, 1]] },
  { name: 'Pixel Pip', platform: 'tiktok', followers: 58_000, views: 34_000, headline: 'Cheap, quick shorts for new and small games.', niches: ['Obby', 'Racing', 'Sandbox'],
    bio: 'Newer creator with unusually high view-to-follower ratio. I offer low prices to build my history — fast turnaround and I’ll re-cut if you ask.',
    packages: [['Quick short', 'One 30–45s TikTok.', 300, 2, 1], ['Short + story', 'TikTok plus 3 story posts.', 650, 3, 1]] },
  { name: 'Ember Arcade', platform: 'youtube', followers: 255_000, views: 95_000, headline: 'Tower defense and strategy videos with real analysis.', niches: ['Tower Defense', 'Fighting'],
    bio: 'Strategy-minded audience that stays to the end. I’ll test your balance, show off progression and give honest feedback in the video.',
    packages: [['Strategy showcase', 'Full video with progression and tips.', 5200, 8, 1]] },
  { name: 'Roleplay Rae', platform: 'both', followers: 129_000, views: 48_000, headline: 'Roleplay and social games — I bring my community in.', niches: ['Roleplay', 'Story'],
    bio: 'I run a small but very active Discord. I’ll host a play session with my community in your game and clip the best moments.',
    packages: [['Community session + clips', 'Live session, plus a YouTube highlight and a TikTok.', 4000, 9, 1]] },
  { name: 'Brickwave', platform: 'tiktok', followers: 301_000, views: 120_000, headline: 'Trend-driven shorts for anime and fighting games.', niches: ['Anime', 'Fighting', 'Shooter'],
    bio: 'I ride sounds and formats that are working this week, and adapt them to your game. Expect a quick turnaround.',
    packages: [['Trend short', 'One trend-based TikTok.', 1800, 3, 1], ['Two-short bundle', 'Two different trend formats.', 3200, 5, 1]] },
];

const reviewText = ['Delivered on time and the video drove real joins. Would book again.', 'Great communication and a clean edit. Exactly what I briefed.', 'Solid. One small revision and it was perfect.', 'Good audience match for my game — a noticeable bump.'];

CREATORS.forEach((c, idx) => {
  const uidc = user(c.name.toLowerCase().replace(/\s+/g, '_'), `${c.name.toLowerCase().replace(/\s+/g, '.')}@creatorlink.local`);
  const cid = uid();
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  run(
    `INSERT INTO creators (id,user_id,slug,display_name,headline,bio,platform,youtube_url,tiktok_url,followers,avg_views,niches,status,created_at,approved_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?)`,
    cid, uidc, slug, c.name, c.headline, c.bio, c.platform,
    c.platform !== 'tiktok' ? `https://youtube.com/@${slug}` : null, c.platform !== 'youtube' ? `https://tiktok.com/@${slug}` : null,
    c.followers, c.views, JSON.stringify(c.niches), now() - (20 - idx) * day, now() - (18 - idx) * day,
  );
  c.packages.forEach(([title, description, price, days, revisions], i) =>
    run('INSERT INTO packages (id,creator_id,title,description,price,delivery_days,revisions,position,created_at) VALUES (?,?,?,?,?,?,?,?,?)', uid(), cid, title, description, price, days, revisions, i, now()),
  );
});

/* A few historical orders so profiles have reviews and the dashboard has life. */
const gameNames = ['Race Clicker X', 'Tycoon Empire', 'Obby Legends', 'Dungeon Drift', 'Sky Farm'];
const creators = all<{ id: string; user_id: string }>('SELECT id, user_id FROM creators');
const reviewers = ['jump_studios', 'buildmaster', 'speedydev', 'pixelforge'].map((n) => user(n, `${n}@creatorlink.local`));
for (const r of reviewers) postEntry(r, 400_000, 'test_deposit', { note: 'Demo funds' });

creators.forEach((c, i) => {
  const pkgs = all<{ id: string }>('SELECT id FROM packages WHERE creator_id = ?', c.id);
  const n = [4, 3, 5, 2, 2, 3, 1, 3][i] ?? 1;
  for (let k = 0; k < n; k++) {
    const buyer = reviewers[(i + k) % reviewers.length];
    const id = createOrder({
      buyerId: buyer, packageId: pkgs[k % pkgs.length].id, gameName: gameNames[(i + k) % gameNames.length],
      gameUrl: 'https://www.roblox.com/games/1234567/demo', brief: 'Demo order generated by the seed script for local development.',
    });
    acceptOrder(id, c.user_id);
    deliverOrder(id, c.user_id, 'https://youtube.com/watch?v=demo', 'Demo delivery');
    approveOrder(id, buyer);
    addReview(id, buyer, k % 5 === 3 ? 4 : 5, reviewText[(i + k) % reviewText.length]);
  }
});

/* Live orders for the demo developer account. */
const kai = creators[0];
const kaiPkg = get<{ id: string }>('SELECT id FROM packages WHERE creator_id = ? ORDER BY price LIMIT 1', kai.id)!;
const live = createOrder({ buyerId: dev, packageId: kaiPkg.id, gameName: 'Race Clicker X', gameUrl: 'https://www.roblox.com/games/1234567/race-clicker-x', brief: 'Show the new rebirth system and the 2x speed pass in the first 5 seconds. Fast, loud, trending sound.' });
acceptOrder(live, kai.user_id);
deliverOrder(live, kai.user_id, 'https://tiktok.com/@kai-plays/video/demo', 'Used your trailer clip at the end — happy to re-cut the hook if you want it punchier.');

const mara = creators[1];
const maraPkg = get<{ id: string }>('SELECT id FROM packages WHERE creator_id = ? ORDER BY price LIMIT 1', mara.id)!;
createOrder({ buyerId: dev, packageId: maraPkg.id, gameName: 'Dungeon Drift', gameUrl: 'https://www.roblox.com/games/7654321/dungeon-drift', brief: 'Looking for an honest first look. The combat and loot system are the focus; ignore the lobby, it’s getting redone.' });

const night = creators[3];
const nightPkg = get<{ id: string }>('SELECT id FROM packages WHERE creator_id = ?', night.id)!;
const disputed = createOrder({ buyerId: reviewers[0], packageId: nightPkg.id, gameName: 'Sky Farm', gameUrl: 'https://www.roblox.com/games/111/sky-farm', brief: 'Horror-themed farming game, please show the night cycle.' });
acceptOrder(disputed, night.user_id);
openDispute(disputed, reviewers[0], 'Creator delivered a video that does not mention the game name or link as agreed.');

console.log('Seeded. Log in with:\n  dev    dev@creatorlink.local    / demo1234\n  admin  admin@creatorlink.local  / demo1234\n  creator kai.plays@creatorlink.local / demo1234');
