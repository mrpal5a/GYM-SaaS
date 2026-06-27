"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the owner's pending-request notification fresh without a manual reload.
 * Periodically (and whenever the tab regains focus) it triggers a soft
 * `router.refresh()`, which re-runs the layout's server-side count so the bell /
 * sidebar badge update on their own when a new request arrives. Client state and
 * scroll position are preserved by the soft refresh. Only mounted for owners.
 */
export function RequestsPoller({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    // Refresh immediately when the owner returns to the tab.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
