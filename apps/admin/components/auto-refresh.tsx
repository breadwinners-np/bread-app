"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the current page on a timer.
 *
 * A customer ordering on their phone writes to the database directly, which the
 * owner's laptop has no way of hearing about — the two apps are separate Next
 * processes and revalidating a path in one does nothing to the other. Without
 * this she would have to keep pressing refresh to notice a new order.
 *
 * A poll rather than a Supabase realtime subscription because it is a few lines
 * and needs no connection to keep alive. If the round ever moves to a phone in a
 * dead zone, this is not the mechanism to reach for.
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
