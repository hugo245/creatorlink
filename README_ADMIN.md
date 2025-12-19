# Admin panel & Supabase notes

- Place Supabase client values in `test/config.js`:
  - `window.SUPABASE_URL = 'https://<project>.supabase.co'`
  - `window.SUPABASE_ANON_KEY = '<your_anon_key>'`

- 403 errors when calling REST endpoints from the browser commonly mean:
  - RLS (Row Level Security) policies block the action for anon users.
  - The anon key does not have permission for the route (check policies).
  - You attempted an operation that requires the `service_role` key (do NOT use service_role in browser).

- To make the client app work with anon keys:
  1. In Supabase Dashboard, enable RLS only if you have suitable policies.
  2. Add policies to allow authenticated users to insert/select/update on tables they own (match user_id = auth.uid()).
  3. For public reads, configure policies explicitly.

- For duplicate-key errors (23505): changed creator insertion to `upsert(..., { onConflict: 'user_id' })` so repeated submissions won't break. If you prefer stricter behavior, check existence first.

- Tailwind CDN warning: `https://cdn.tailwindcss.com` is okay for development, but for production follow Tailwind's docs and build with PostCSS or the Tailwind CLI: https://tailwindcss.com/docs/installation

- Admin usage:
  - Open `test/admin.html` in the browser (via local server) and ensure `test/config.js` has your anon key and URL.
  - The admin panel uses the anon key, so you still need policies that allow reads/updates for admins; consider creating an `is_admin` boolean on `profiles` and writing policies that allow updates for users with that flag. Alternatively run actions server-side with the service_role key.
