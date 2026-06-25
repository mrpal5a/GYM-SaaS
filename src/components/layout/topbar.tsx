import Image from "next/image";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function Topbar({
  gymName,
  logoUrl,
}: {
  gymName?: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between px-4 print:hidden">
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={gymName ? `${gymName} logo` : "Gym logo"}
            width={28}
            height={28}
            className="size-7 rounded-md object-cover"
            unoptimized
          />
        ) : null}
        <span className="font-semibold">{gymName || "GymFlow Pro"}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}><Button variant="ghost" size="sm">Sign out</Button></form>
      </div>
    </header>
  );
}
