/** Promote a user to admin: `npm run make-admin -- someone@example.com` */
import { get, run } from '../src/lib/db';

const email = process.argv[2];
if (!email) throw new Error('Usage: npm run make-admin -- <email>');
const u = get<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?)', email);
if (!u) throw new Error(`No user with email ${email}`);
run("UPDATE users SET role = 'admin' WHERE id = ?", u.id);
console.log(`${email} is now an admin.`);
