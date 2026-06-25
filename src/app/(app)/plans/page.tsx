import { TagIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";
import { PlanForm } from "@/components/plans/plan-form";
import { setPlanActiveAction, deletePlanAction } from "@/actions/plans";
import { formatMoney } from "@/lib/members/metrics";
import type { MembershipPlan } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("membership_plans")
    .select("*")
    .order("is_active", { ascending: false })
    .order("price");
  const plans = (data ?? []) as MembershipPlan[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Membership plans</h1>
        <p className="text-sm text-muted-foreground">
          Define the plans members can be enrolled in.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {plans.length === 0 ? (
            <Card className="glass flex flex-col items-center gap-3 p-12 text-center">
              <TagIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No plans yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first plan using the form.
                </p>
              </div>
            </Card>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} className={`glass ${plan.is_active ? "" : "opacity-60"}`}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {!plan.is_active && <Badge>Archived</Badge>}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatMoney(plan.price)}</div>
                    <div className="text-xs text-muted-foreground">{plan.duration_days} days</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={setPlanActiveAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="isActive" value={(!plan.is_active).toString()} />
                      <Button type="submit" variant="outline" size="sm">
                        {plan.is_active ? "Archive" : "Restore"}
                      </Button>
                    </form>
                    <form action={deletePlanAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <ConfirmButton
                        message={`Delete the "${plan.name}" plan? Past memberships keep their snapshot.`}
                        variant="destructive"
                        size="sm"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>New plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
