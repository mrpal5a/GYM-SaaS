import Link from "next/link";
import { AlarmClockIcon, CalendarX2Icon, MessageCircleIcon, RefreshCwIcon, PhoneOffIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGymContext } from "@/lib/auth/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
>;

export default async function RenewalsPage() {
  const supabase = await createClient();
  const ctx = await getGymContext();

  const [{ data: gym }, { data: membersData }, { data: plansData }] = await Promise.all([
    ctx
      ? supabase.from("gyms").select("name").eq("id", ctx.gymId).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    supabase
      .from("member_with_status")
      .select("id, full_name, photo_url, phone, plan_id, plan_name, end_date, membership_status")
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

  const expiringCount = rows.filter((r) => r.membership_status === "expiring").length;
  const expiredCount = rows.filter((r) => r.membership_status === "expired").length;
  const potentialRevenue = rows.reduce(
    (sum, r) => sum + (r.plan_id ? planPrice.get(r.plan_id) ?? 0 : 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Renewals</h1>
        <p className="text-sm text-muted-foreground">
          Members to follow up with — send a WhatsApp reminder or renew in one tap.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Expiring this week" value={expiringCount} icon={AlarmClockIcon} />
        <StatCard label="Already expired" value={expiredCount} icon={CalendarX2Icon} />
        <StatCard
          label="Revenue at stake"
          value={formatMoney(potentialRevenue)}
          hint="if everyone renews"
          icon={RefreshCwIcon}
        />
      </div>

      <Card className="glass overflow-hidden p-0">
        <CardHeader className="p-4">
          <CardTitle>Follow-up list</CardTitle>
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
                  {rows.map((m) => {
                    const left = daysUntil(m.end_date);
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
                            <div className="font-medium">{m.full_name}</div>
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
