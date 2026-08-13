import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/storefront/.env.local — see README.md.",
  );
}

/**
 * Anon key only, so it is safe wherever this is imported. Row-level security
 * decides what it can see — currently just the public product catalog.
 */
export const supabasePublic = createClient(url, anonKey);
