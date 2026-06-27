"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

type Dir = "forward" | "back";
type Leaving = { node: React.ReactNode; dir: Dir; key: string };
type Snapshot = { pathname: string; children: React.ReactNode; stack: string[]; dir: Dir };

/**
 * Cross-slides between routes: when the path changes, the outgoing page is kept on
 * screen for one beat and slides away while the incoming page slides in from the
 * opposite side. Direction matches intent — deeper/forward navigations slide in
 * from the right, going back slides in from the left — derived from a small stack
 * of visited paths.
 *
 * State (not refs) drives this so it stays compatible with concurrent rendering:
 * `snap` holds the current page (path + its children + the stack), updated only on
 * a path change via the documented "adjust state during render" pattern; the
 * previous `snap.children` becomes the outgoing layer. Keying each layer by its
 * path (re)triggers the CSS animations in globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [snap, setSnap] = useState<Snapshot>({ pathname, children, stack: [pathname], dir: "forward" });
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  if (snap.pathname !== pathname) {
    let dir: Dir = "forward";
    let stack = snap.stack;
    if (stack.length >= 2 && stack[stack.length - 2] === pathname) {
      stack = stack.slice(0, -1);
      dir = "back";
    } else if (stack[stack.length - 1] !== pathname) {
      stack = [...stack, pathname];
      dir = "forward";
    }
    // Promote the page we're leaving to its own animating-out layer.
    setLeaving({ node: snap.children, dir, key: snap.pathname });
    setSnap({ pathname, children, stack, dir });
  }

  return (
    <div className="pt-stage">
      {leaving ? (
        <div
          key={leaving.key}
          className="pt-layer pt-leaving"
          data-dir={leaving.dir}
          onAnimationEnd={(e) => {
            if (e.animationName.startsWith("pt-out")) setLeaving(null);
          }}
        >
          {leaving.node}
        </div>
      ) : null}
      <div key={pathname} className="pt-layer pt-entering" data-dir={snap.dir}>
        {children}
      </div>
    </div>
  );
}
