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
 *
 * Two things keep the poll out of her way, because a refresh is a full
 * server render of a page that reads several tables:
 *
 *   - It stops while the tab is in the background. A laptop left open on this
 *     screen all day was re-rendering it every ten seconds for nobody.
 *   - It skips a beat while she is interacting, so a refresh started a moment
 *     before a click cannot leave that click waiting behind it.
 */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let lastInteraction = 0;
    const noteInteraction = () => {
      lastInteraction = Date.now();
    };

    const events = ["pointerdown", "keydown"] as const;
    for (const event of events) {
      window.addEventListener(event, noteInteraction, { passive: true });
    }

    const id = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastInteraction < 3000) return;
      router.refresh();
    }, seconds * 1000);

    return () => {
      clearInterval(id);
      for (const event of events) {
        window.removeEventListener(event, noteInteraction);
      }
    };
  }, [router, seconds]);

  return null;
}
