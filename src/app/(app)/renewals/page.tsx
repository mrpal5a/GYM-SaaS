import Link from "next/link";
import { AlarmClockIcon, CalendarX2Icon, MessageCircleIcon, RefreshCwIcon, PhoneOffIcon, MailCheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendRemindersButton } from "@/components/renewals/send-reminders-button";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { renewMembershipAction } from "@/actions/memberships";
import { formatDate, formatMoney, daysUntil } from "@/lib/members/metrics";
import { buildRenewalMessage, buildWhatsAppLink } from "@/lib/members/whatsapp";
import { cn } from "@/lib/utils";
import type { MemberWithStatus, MembershipPlan } from "@/types/db";

export const dynamic = "force-dynamic";

type RenewalRow = Pick<
  MemberWithStatus,
  | "id"
  | "full_name"
  | "photo_url"
  | "phone"
  | "plan_id"
  | "plan_name"
  | "end_date"
  | "membership_status"
  | "subscription_id"
>;

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const ctx = await getGymContext();
  const canManage = ctx ? canManageGym(ctx.role) : false;

  const [{ data: gym }, { data: membersData }, { data: plansData }] = await Promise.all([
    ctx
      ? supabase.from("gyms").select("name").eq("id", ctx.gymId).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    supabase
      .from("member_with_status")
      .select("id, full_name, photo_url, phone, plan_id, plan_name, end_date, membership_status, subscription_id")
      .in("membership_status", ["expiring", "expired"]),
    supabase.from("membership_plans").select("id, price"),
  ]);

  const gymName = gym?.name ?? "our gym";
  const rows = (membersData ?? []) as RenewalRow[];
  const planPrice = new Map(
    ((plansData ?? []) as Pick<MembershipPlan, "id" | "price">[]).map((p) => [p.id, Number(p.price)]),
  );

  // Soonest-expiring (and most-overdue) first.
  rows.sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));

  // Which of these members have already been emailed a reminder (for their current
  // subscription), and when the most recent one went out. RLS scopes to this gym.
  const subIds = rows.map((r) => r.subscription_id).filter((id): id is string => !!id);
  const remindedAt = new Map<string, string>();
  if (subIds.length > 0) {
    const { data: reminderRows } = await supabase
      .from("renewal_reminders")
      .select("subscription_id, sent_at")
      .eq("status", "sent")
      .in("subscription_id", subIds)
      .order("sent_at", { ascending: false });
    for (const r of (reminderRows ?? []) as { subscription_id: string | null; sent_at: string }[]) {
      // Rows are newest-first, so keep the first (latest) seen per subscription.
      if (r.subscription_id && !remindedAt.has(r.subscription_id)) {
        remindedAt.set(r.subscription_id, r.sent_at);
      }
    }
  }

  // Stats reflect the whole follow-up list; the search only narrows what's shown.
  const expiringCount = rows.filter((r) => r.membership_status === "expiring").length;
  const expiredCount = rows.filter((r) => r.membership_status === "expired").length;
  const potentialRevenue = rows.reduce(
    (sum, r) => sum + (r.plan_id ? planPrice.get(r.plan_id) ?? 0 : 0),
    0,
  );

  const term = q.trim().toLowerCase();
  const visibleRows = term
    ? rows.filter(
        (r) =>
          r.full_name.toLowerCase().includes(term) ||
          (r.phone ?? "").toLowerCase().includes(term) ||
          (r.plan_name ?? "").toLowerCase().includes(term),
      )
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Renewals</h1>
          <p className="text-sm text-muted-foreground">
            Members to follow up with — send a WhatsApp reminder or renew in one tap.
          </p>
        </div>
        {canManage && <SendRemindersButton />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Expiring this week"
          value={expiringCount}
          icon={AlarmClockIcon}
          href="/members?status=expiring"
        />
        <StatCard
          label="Already expired"
          value={expiredCount}
          icon={CalendarX2Icon}
          href="/members?status=expired"
        />
        <StatCard
          label="Revenue at stake"
          value={formatMoney(potentialRevenue)}
          hint="if everyone renews"
          icon={RefreshCwIcon}
          href="/members?status=expiring,expired"
        />
      </div>

      <Card className="glass overflow-hidden p-0">
        <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Follow-up list</CardTitle>
          {rows.length > 0 && (
            <SearchToolbar initialQuery={q} placeholder="Search by name, phone, or plan…" />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <RefreshCwIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">You&apos;re all caught up</p>
              <p className="text-sm text-muted-foreground">
                No memberships are expiring soon or overdue. Nice work!
              </p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <RefreshCwIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">No matching members</p>
              <p className="text-sm text-muted-foreground">
                Try a different name, phone number, or plan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                    <th className="px-4 py-3 text-right font-medium">Follow up</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((m) => {
                    const left = daysUntil(m.end_date);
                    const remindedOn = m.subscription_id
                      ? remindedAt.get(m.subscription_id)
                      : undefined;
                    const waLink = buildWhatsAppLink(
                      m.phone,
                      buildRenewalMessage({
                        memberName: m.full_name,
                        planName: m.plan_name,
                        gymName,
                        endDate: m.end_date,
                        status: m.membership_status,
                      }),
                    );
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                            <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                            <div>
                              <div className="font-medium">{m.full_name}</div>
                              {remindedOn && (
                                <div
                                  className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                                  title={`Renewal reminder emailed on ${formatDate(remindedOn.slice(0, 10))}`}
                                >
                                  <MailCheckIcon className="size-3" />
                                  Reminded {formatDate(remindedOn.slice(0, 10))}
                                </div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.plan_name || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={m.membership_status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground">{formatDate(m.end_date)}</span>
                          {left !== null && (
                            <span
                              className={cn(
                                "ml-2 text-xs",
                                left < 0
                                  ? "text-destructive"
                                  : "text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {left < 0
                                ? `${Math.abs(left)}d overdue`
                                : left === 0
                                  ? "today"
                                  : `in ${left}d`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                <MessageCircleIcon /> WhatsApp
                              </a>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                title="No valid phone number on file"
                              >
                                <PhoneOffIcon className="size-3.5" /> No phone
                              </span>
                            )}
                            {m.plan_id && (
                              <form action={renewMembershipAction}>
                                <input type="hidden" name="memberId" value={m.id} />
                                <input type="hidden" name="planId" value={m.plan_id} />
                                <ConfirmButton
                                  size="sm"
                                  message={`Renew ${m.full_name}'s ${m.plan_name ?? "plan"} and record the payment?`}
                                >
                                  <RefreshCwIcon /> Renew
                                </ConfirmButton>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
