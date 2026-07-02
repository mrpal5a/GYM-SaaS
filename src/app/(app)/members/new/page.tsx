import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MemberForm } from "@/components/members/member-form";
import { createMemberAction } from "@/actions/members";
import type { MembershipPlan } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewMemberPage() {
  const supabase = await createClient();
  const [{ data: plansData }, { data: groupsData }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("id, name, price, duration_days, kind")
      .eq("is_active", true)
      .order("price"),
    supabase.from("member_groups").select("id, name").order("name"),
  ]);
  const allPlans = (plansData ?? []) as Pick<
    MembershipPlan,
    "id" | "name" | "price" | "duration_days" | "kind"
  >[];
  const plans = allPlans.filter((p) => p.kind !== "personal_trainer");
  const trainerPlans = allPlans.filter((p) => p.kind === "personal_trainer");
  const groups = (groupsData ?? []) as { id: string; name: string }[];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Back to members
      </Link>
      <Card className="glass p-6">
        <h1 className="mb-1 text-xl font-semibold">Add member</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Create a new member profile and optionally assign a plan in one step.
        </p>
        <MemberForm
          action={createMemberAction}
          plans={plans}
          trainerPlans={trainerPlans}
          groups={groups}
          submitLabel="Create member"
        />
      </Card>
    </div>
  );
}
