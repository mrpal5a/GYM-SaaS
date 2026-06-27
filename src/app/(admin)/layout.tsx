import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/auth/admin-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5 font-semibold">
          <ShieldCheckIcon className="size-5 shrink-0 text-primary" />
          <span className="truncate">GymFlow Pro · Admin</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </header>
      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
