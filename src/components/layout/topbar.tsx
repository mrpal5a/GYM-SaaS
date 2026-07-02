import Image from "next/image";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function Topbar({
  gymName,
  logoUrl,
  canManage = false,
  canReview = false,
  pendingRequests = 0,
}: {
  gymName?: string;
  logoUrl?: string | null;
  canManage?: boolean;
  canReview?: boolean;
  pendingRequests?: number;
}) {
  return (
    <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between gap-2 px-3 sm:px-4 print:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <MobileNav canManage={canManage} canReview={canReview} pendingRequests={pendingRequests} />
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={gymName ? `${gymName} logo` : "Gym logo"}
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-md object-cover"
            unoptimized
          />
        ) : null}
        <span className="truncate font-semibold">{gymName || "GymFlow Pro"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {canReview && <NotificationBell pendingRequests={pendingRequests} />}
        <ThemeToggle />
        <form action={logoutAction}><Button type="submit" variant="ghost" size="sm">Sign out</Button></form>
      </div>
    </header>
  );
}
