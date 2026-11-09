/** Connects and applies any pending migrations: `npm run migrate` (uses DATABASE_URL if set). */
import { get } from '../src/lib/db';

await get('SELECT 1 AS ok');
console.log('Database is up to date.');
process.exit(0);
