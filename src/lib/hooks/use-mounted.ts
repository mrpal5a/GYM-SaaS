import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false during SSR and the first client render, true afterwards — a
 * hydration-safe "have we mounted?" flag. Implemented with useSyncExternalStore
 * (server snapshot = false, client snapshot = true) so it needs no
 * setState-in-effect: handy for client-only concerns like portals.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
