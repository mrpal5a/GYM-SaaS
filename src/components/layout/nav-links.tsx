"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  UsersIcon,
  TagIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SettingsIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

const baseItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/members", label: "Members", icon: UsersIcon },
  { href: "/renewals", label: "Renewals", icon: RefreshCwIcon },
  { href: "/plans", label: "Plans", icon: TagIcon },
  { href: "/payments", label: "Payments", icon: ReceiptIcon },
];

/**
 * The app's primary navigation list, shared by the desktop sidebar and the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is tapped.
 */
export function NavLinks({
  canManage = false,
  pendingRequests = 0,
  onNavigate,
}: {
  canManage?: boolean;
  pendingRequests?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navItems: NavItem[] = canManage
    ? [
        ...baseItems,
        { href: "/join-requests", label: "Requests", icon: UserPlusIcon, badge: pendingRequests },
        { href: "/settings", label: "Settings", icon: SettingsIcon },
      ]
    : baseItems;

  return (
    <nav className="space-y-1">
      {navItems.map((i) => {
        const active = pathname === i.href || pathname.startsWith(i.href + "/");
        const Icon = i.icon;
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-foreground/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{i.label}</span>
            {i.badge ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {i.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
