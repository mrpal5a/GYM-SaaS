"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A YouTube-style top loading bar that gives instant feedback the moment a
 * navigation starts. App Router renders nothing visible between a link click
 * and the server's RSC response, which makes the app *feel* slow even when it
 * isn't — this bar fills that gap.
 *
 * It starts on any same-origin link click (sidebar, topbar, in-page links) and
 * completes once the route actually changes. No external dependency.
 */
export function TopProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (trickle.current) clearInterval(trickle.current);
    if (hide.current) clearTimeout(hide.current);
    trickle.current = null;
    hide.current = null;
  };

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setWidth(8);
    // Creep toward ~90% so the bar always feels alive while we wait.
    trickle.current = setInterval(() => {
      setWidth((w) => (w >= 90 ? w : w + (90 - w) * 0.12));
    }, 200);
  }, []);

  const done = useCallback(() => {
    clearTimers();
    setWidth(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 220);
  }, []);

  // Route changed → the new segment has committed, finish the bar. Completing the
  // bar in response to navigation is a legitimate "sync with an external system"
  // effect; the setState is intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Detect navigation intent from clicks on internal links.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same destination → no navigation will happen.
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;

      start();
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  useEffect(() => clearTimers, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
