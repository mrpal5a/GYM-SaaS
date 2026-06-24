import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between px-4">
      <span className="font-semibold">GymFlow Pro</span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}><Button variant="ghost" size="sm">Sign out</Button></form>
      </div>
    </header>
  );
}
