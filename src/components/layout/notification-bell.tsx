import Link from "next/link";
import { BellIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Owner-facing notification bell in the topbar. Shows a red count badge when join
 * requests are awaiting review, and links straight to the review queue. Lives in
 * the topbar so it's visible on every screen size — unlike the sidebar badge,
 * which is tucked inside the (closed) hamburger drawer on mobile.
 */
export function NotificationBell({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const hasPending = pendingRequests > 0;
  return (
    <Link
      href="/join-requests"
      aria-label={
        hasPending
          ? `${pendingRequests} join ${pendingRequests === 1 ? "request" : "requests"} awaiting review`
          : "Join requests"
      }
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <BellIcon className="size-5" />
      {hasPending && (
        <>
          {/* Soft pulsing halo to draw the eye to a fresh request. */}
          <span className="absolute -right-0.5 -top-0.5 inline-flex size-4 animate-ping rounded-full bg-red-500/60" />
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {pendingRequests > 99 ? "99+" : pendingRequests}
          </span>
        </>
      )}
    </Link>
  );
}
