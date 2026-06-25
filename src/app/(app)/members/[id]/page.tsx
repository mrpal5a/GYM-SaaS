import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MemberAvatar } from "@/components/members/member-avatar";
import { StatusBadge } from "@/components/members/status-badge";
import { DeleteMemberButton } from "@/components/members/delete-member-button";
import { AssignMembershipForm } from "@/components/memberships/assign-membership-form";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { cancelMembershipAction } from "@/actions/memberships";
import { calcBmi, daysUntil, formatDate, formatMoney } from "@/lib/members/metrics";
import type { MemberWithStatus, MembershipPlan, Payment } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: memberRow } = await supabase
    .from("member_with_status")
    .select("*")
    .eq("id", id)
    .single();
  if (!memberRow) notFound();
  const member = memberRow as MemberWithStatus;

  const [{ data: plansData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("id, name, price, duration_days")
      .eq("is_active", true)
      .order("price"),
    supabase
      .from("payments")
      .select("*")
      .eq("member_id", id)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);
  const plans = (plansData ?? []) as Pick<MembershipPlan, "id" | "name" | "price" | "duration_days">[];
  const payments = (paymentsData ?? []) as Payment[];

  const bmi = calcBmi(member.height_cm, member.weight_kg);
  const remaining = daysUntil(member.end_date);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Back to members
      </Link>

      {/* Header */}
      <Card className="glass p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <MemberAvatar name={member.full_name} photoUrl={member.photo_url} size="lg" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{member.full_name}</h1>
                {!member.is_active && <Badge>Inactive</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge status={member.membership_status} />
                {member.phone && <span>{member.phone}</span>}
                {member.email && <span>· {member.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/members/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <PencilIcon /> Edit
            </Link>
            <DeleteMemberButton memberId={id} name={member.full_name} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: profile + metrics + payments */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="Gender" value={member.gender ? cap(member.gender) : "—"} />
              <Detail label="Date of birth" value={formatDate(member.date_of_birth)} />
              <Detail label="Joined" value={formatDate(member.joined_at)} />
              <Detail label="Phone" value={member.phone || "—"} />
              <Detail label="Email" value={member.email || "—"} />
              <Detail label="Address" value={member.address || "—"} />
              {member.notes && (
                <div className="sm:col-span-2">
                  <Detail label="Notes" value={member.notes} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Body metrics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-8">
              <Metric label="Height" value={member.height_cm ? `${member.height_cm} cm` : "—"} />
              <Metric label="Weight" value={member.weight_kg ? `${member.weight_kg} kg` : "—"} />
              <div>
                <p className="text-xs text-muted-foreground">BMI</p>
                {bmi ? (
                  <p className="text-lg font-semibold">
                    {bmi.value}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({bmi.category})
                    </span>
                  </p>
                ) : (
                  <p className="text-lg font-semibold">—</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Total paid: <span className="font-medium text-foreground">{formatMoney(totalPaid)}</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium">Amount</th>
                          <th className="py-2 pr-4 font-medium">Method</th>
                          <th className="py-2 font-medium">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-t border-border/40">
                            <td className="py-2 pr-4">{formatDate(p.paid_at.slice(0, 10))}</td>
                            <td className="py-2 pr-4 font-medium">{formatMoney(Number(p.amount))}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{methodLabel(p.method)}</td>
                            <td className="py-2 font-mono text-xs">
                              <Link
                                href={`/invoice/${p.id}`}
                                className="text-muted-foreground hover:text-foreground hover:underline"
                              >
                                {p.invoice_number || "View"}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: membership + record payment */}
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Membership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.subscription_id && member.membership_status !== "none" ? (
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{member.plan_name}</span>
                    <StatusBadge status={member.membership_status} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(member.start_date)} → {formatDate(member.end_date)}
                  </div>
                  {remaining !== null && (
                    <div className="text-sm">
                      {remaining >= 0
                        ? `${remaining} day${remaining === 1 ? "" : "s"} remaining`
                        : `Expired ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago`}
                    </div>
                  )}
                  <form action={cancelMembershipAction}>
                    <input type="hidden" name="subscriptionId" value={member.subscription_id} />
                    <input type="hidden" name="memberId" value={id} />
                    <ConfirmButton
                      message="Cancel this membership?"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                    >
                      Cancel membership
                    </ConfirmButton>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active membership.</p>
              )}

              <div className="border-t border-border/40 pt-3">
                <p className="mb-2 text-sm font-medium">
                  {member.membership_status === "none" ? "Assign a plan" : "Renew / change plan"}
                </p>
                <AssignMembershipForm memberId={id} plans={plans} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Record payment</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordPaymentForm memberId={id} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function methodLabel(method: string): string {
  return method === "bank_transfer" ? "Bank transfer" : cap(method);
}
