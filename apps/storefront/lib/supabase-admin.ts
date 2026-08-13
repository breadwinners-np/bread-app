import "server-only";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase server credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "SUPABASE_SERVICE_ROLE_KEY in apps/storefront/.env.local — see README.md.",
  );
}

/**
 * Bypasses row-level security. Every order and order_items read or write goes
 * through this client from a server action or Server Component — never from
 * a client component. The `server-only` import above turns an accidental
 * client-side import into a build error rather than a leaked key.
 */
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
