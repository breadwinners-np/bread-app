import "server-only";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Throws rather than falling back to empty data. A missing env var would
// otherwise render the owner a working-looking bakery with no orders, no
// customers and GHS 0.00 of everything, returned with a green HTTP 200.
if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in apps/admin/.env.local — see .env.example.",
  );
}

/**
 * Bypasses row-level security by design. The admin app is the owner's own
 * screen and is server-rendered throughout; this client must never be imported
 * from a client component, which the `server-only` import above enforces.
 */
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
