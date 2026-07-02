import Link from "next/link";
import { UsersIcon, BadgeCheckIcon, AlarmClockIcon, IndianRupeeIcon, UserPlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGymContext } from "@/lib/auth/context";
import { canReviewRequests } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { buildMonthlyStats } from "@/lib/dashboard/monthly-stats";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { PlanExpiryBanner } from "@/components/dashboard/plan-expiry-banner";
import { getPlanBanner, type PlanBanner } from "@/lib/billing/plan-status";
import { buildSupportWhatsappLink } from "@/lib/billing/support-link";
import { formatMoney, formatDate, daysUntil } from "@/lib/members/metrics";
import type { MemberWithStatus, Payment, SubStatus } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Months shown in the monthly-overview chart (horizontally scrollable).
  const CHART_MONTHS = 12;
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - (CHART_MONTHS - 1), 1);
  windowStart.setHours(0, 0, 0, 0);

  const [{ data: membersData }, { data: paymentsData }, { data: subsData }] = await Promise.all([
    supabase
      .from("member_with_status")
      .select("id, full_name, photo_url, membership_status, end_date, plan_name, created_at, joined_at"),
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", windowStart.toISOString()),
    // Membership subscriptions ending within the monthly-chart window, for the
    // "expiring" series. The chart helper ignores anything outside the window.
    supabase
      .from("member_subscriptions")
      .select("end_date")
      .eq("kind", "membership")
      .gte("end_date", windowStart.toISOString().slice(0, 10)),
  ]);

  const members = (membersData ?? []) as Pick<
    MemberWithStatus,
    "id" | "full_name" | "photo_url" | "membership_status" | "end_date" | "plan_name" | "created_at" | "joined_at"
  >[];
  const payments = (paymentsData ?? []) as Pick<Payment, "amount" | "paid_at">[];
  const subscriptions = (subsData ?? []) as { end_date: string | null }[];

  // Owners + staff see a banner when join requests are awaiting review (RLS scopes the count).
  const ctx = await getGymContext();
  const canReview = ctx ? canReviewRequests(ctx.role) : false;
  let pendingRequests = 0;
  if (canReview) {
    const { count } = await supabase
      .from("join_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingRequests = count ?? 0;
  }

  // The SaaS plan-expiry warning is the owner's concern (they pay the bill), so
  // only gym owners see it. RLS scopes both rows to the caller's gym.
  let planBanner: PlanBanner | null = null;
  let planMessage = "";
  let planWhatsappHref: string | null = null;
  if (ctx?.role === "gym_owner") {
    const [{ data: subRow }, { data: gymRow }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("gym_id", ctx.gymId)
        .maybeSingle(),
      supabase.from("gyms").select("name").eq("id", ctx.gymId).maybeSingle(),
    ]);
    planBanner = getPlanBanner({
      status: (subRow?.status as SubStatus | undefined) ?? null,
      currentPeriodEnd: subRow?.current_period_end ?? null,
    });
    if (planBanner) {
      const gymName = gymRow?.name ?? "your gym";
      planMessage =
        planBanner.severity === "expired"
          ? `Your GymFlow plan for ${gymName} has expired. Renew now to avoid interruption to your account.`
          : `Your GymFlow plan for ${gymName} will expire in ${planBanner.days} ${planBanner.days === 1 ? "day" : "days"}. Please renew to keep access.`;
      planWhatsappHref = buildSupportWhatsappLink(
        `Hi, I'd like to renew my GymFlow plan for ${gymName}.`,
      );
    }
  }

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

  // Month-by-month overview for the chart (revenue + new members + expiring + payments).
  const monthly = buildMonthlyStats({ payments, members, subscriptions }, now, CHART_MONTHS);

  return (
    <div className="space-y-4">
      {planBanner && (
        <PlanExpiryBanner
          severity={planBanner.severity}
          message={planMessage}
          whatsappHref={planWhatsappHref}
        />
      )}

      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your gym at a glance.</p>
      </div>

      {canReview && pendingRequests > 0 && (
        <Link
          href="/join-requests"
          className="glass flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
          <UserPlusIcon className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {pendingRequests} new join {pendingRequests === 1 ? "request" : "requests"} awaiting review
            </p>
            <p className="text-xs text-muted-foreground">Members who registered via your QR code.</p>
          </div>
          <span className="text-sm font-medium text-primary">Review →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total members" value={totalMembers} icon={UsersIcon} href="/members" />
        <StatCard
          label="Active memberships"
          value={activeCount}
          hint={totalMembers ? `${Math.round((activeCount / totalMembers) * 100)}% of members` : undefined}
          icon={BadgeCheckIcon}
          href="/members?status=active,expiring"
        />
        <StatCard
          label="Expiring in 7 days"
          value={expiringSoon.length}
          icon={AlarmClockIcon}
          href="/members?status=expiring"
        />
        <StatCard
          label="Revenue this month"
          value={formatMoney(monthRevenue)}
          icon={IndianRupeeIcon}
          href="/payments"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="glass self-start lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly overview · last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={monthly} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expiring soon</CardTitle>
            <Link href="/renewals" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
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
