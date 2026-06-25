"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboardIcon, UsersIcon, TagIcon, ReceiptIcon, RefreshCwIcon, SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/members", label: "Members", icon: UsersIcon },
  { href: "/renewals", label: "Renewals", icon: RefreshCwIcon },
  { href: "/plans", label: "Plans", icon: TagIcon },
  { href: "/payments", label: "Payments", icon: ReceiptIcon },
];

export function Sidebar({ canManage = false }: { canManage?: boolean }) {
  const pathname = usePathname();
  const navItems = canManage
    ? [...items, { href: "/settings", label: "Settings", icon: SettingsIcon }]
    : items;
  return (
    <aside className="glass hidden w-56 shrink-0 p-4 md:block print:hidden">
      <nav className="space-y-1">
        {navItems.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-foreground/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
