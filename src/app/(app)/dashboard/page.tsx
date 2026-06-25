import Link from "next/link";
import { UsersIcon, BadgeCheckIcon, AlarmClockIcon, IndianRupeeIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { formatMoney, formatDate, daysUntil } from "@/lib/members/metrics";
import type { MemberWithStatus, Payment } from "@/types/db";

export const dynamic = "force-dynamic";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function DashboardPage() {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [{ data: membersData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from("member_with_status")
      .select("id, full_name, photo_url, membership_status, end_date, plan_name, created_at"),
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", sixMonthsAgo.toISOString()),
  ]);

  const members = (membersData ?? []) as Pick<
    MemberWithStatus,
    "id" | "full_name" | "photo_url" | "membership_status" | "end_date" | "plan_name" | "created_at"
  >[];
  const payments = (paymentsData ?? []) as Pick<Payment, "amount" | "paid_at">[];

  // Stats
  const totalMembers = members.length;
  const activeCount = members.filter(
    (m) => m.membership_status === "active" || m.membership_status === "expiring",
  ).length;
  const expiringSoon = members
    .filter((m) => m.membership_status === "expiring")
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = payments
    .filter((p) => new Date(p.paid_at) >= monthStart)
    .reduce((s, p) => s + Number(p.amount), 0);

  // Revenue per month for the last 6 months
  const buckets: RevenuePoint[] = [];
  const byKey = new Map<string, number>();
  for (const p of payments) {
    const d = new Date(p.paid_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    byKey.set(key, (byKey.get(key) ?? 0) + Number(p.amount));
  }
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.push({ label: MONTH_LABELS[d.getMonth()], value: byKey.get(key) ?? 0 });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your gym at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total members" value={totalMembers} icon={UsersIcon} />
        <StatCard
          label="Active memberships"
          value={activeCount}
          hint={totalMembers ? `${Math.round((activeCount / totalMembers) * 100)}% of members` : undefined}
          icon={BadgeCheckIcon}
        />
        <StatCard
          label="Expiring in 7 days"
          value={expiringSoon.length}
          icon={AlarmClockIcon}
        />
        <StatCard
          label="Revenue this month"
          value={formatMoney(monthRevenue)}
          icon={IndianRupeeIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue · last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={buckets} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Expiring soon</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No memberships expiring in the next 7 days.
              </p>
            ) : (
              <ul className="space-y-3">
                {expiringSoon.slice(0, 8).map((m) => {
                  const left = daysUntil(m.end_date);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/members/${m.id}`}
                        className="flex items-center gap-3 rounded-md p-1 hover:bg-foreground/5"
                      >
                        <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{m.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.plan_name} · {formatDate(m.end_date)}
                          </div>
                        </div>
                        <span className="text-xs whitespace-nowrap text-amber-600 dark:text-amber-400">
                          {left === 0 ? "today" : `${left}d`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Recently added members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members yet.{" "}
              <Link href="/members/new" className="underline">
                Add your first member
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {[...members]
                .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
                .slice(0, 6)
                .map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/members/${m.id}`}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-foreground/5"
                    >
                      <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                      <span className="flex-1 truncate text-sm">{m.full_name}</span>
                      <StatusBadge status={m.membership_status} />
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
