"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/layout/nav-links";
import { useMounted } from "@/lib/hooks/use-mounted";
import { cn } from "@/lib/utils";

/**
 * Mobile-only (`md:hidden`) navigation: a hamburger button that opens a left
 * slide-in drawer reusing <NavLinks>. Closes on link tap, backdrop tap, or Escape.
 *
 * The drawer + backdrop are rendered through a portal to <body>. This is load-
 * bearing: the topbar uses `backdrop-filter` (the `glass` style), and a
 * backdrop-filter on an ancestor makes `position: fixed` descendants resolve
 * against that ancestor's box (the ~56px header) instead of the viewport. The
 * portal lifts them out so the drawer fills the screen and the backdrop dims the
 * whole page.
 */
export function MobileNav({
  canManage = false,
  pendingRequests = 0,
}: {
  canManage?: boolean;
  pendingRequests?: number;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </Button>

      {mounted &&
        createPortal(
          <div className="md:hidden">
            {/* Dimmed backdrop */}
            <div
              className={cn(
                "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
                open ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-in drawer */}
            <div
              ref={panelRef}
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              tabIndex={-1}
              inert={!open}
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] flex-col border-r border-border bg-background p-4 shadow-2xl outline-none transition-transform duration-200 ease-out",
                open ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">Menu</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <XIcon />
                </Button>
              </div>
              <NavLinks
                canManage={canManage}
                pendingRequests={pendingRequests}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
