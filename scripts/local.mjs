// One-command local start: `npm run local`
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node 22.13+ is required (you have ${process.versions.node}). Get it at https://nodejs.org`);
  process.exit(1);
}
if (!existsSync('.env.local')) {
  writeFileSync('.env.local', 'ENABLE_TEST_FUNDS=true\n');
  console.log('Created .env.local (test funds enabled for local use).');
}
const sh = process.platform === 'win32';
spawnSync('npm', ['run', 'seed'], { stdio: 'inherit', shell: sh });
console.log('\n→ Open http://localhost:3000\n  Logins (password demo1234): dev@creatorlink.local · kai.plays@creatorlink.local · admin@creatorlink.local\n');
spawnSync('npx', ['next', 'dev', '-p', '3000'], { stdio: 'inherit', shell: sh });
