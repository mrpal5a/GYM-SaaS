import Image from "next/image";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/components/join/join-form";
import { buildUpiUri, qrDataUrl } from "@/lib/gym/join-link";
import type { Gym, MembershipPlan } from "@/types/db";

export const dynamic = "force-dynamic";

type GymPublic = Pick<Gym, "id" | "name" | "logo_url" | "upi_id" | "upi_payee_name">;
type PlanOption = Pick<MembershipPlan, "id" | "name" | "price" | "duration_days" | "description">;

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  // The unguessable token resolves to exactly one gym; no auth needed.
  const { data: gym } = await admin
    .from("gyms")
    .select("id, name, logo_url, upi_id, upi_payee_name")
    .eq("join_token", token)
    .single<GymPublic>();
  if (!gym) notFound();

  const { data: planRows } = await admin
    .from("membership_plans")
    .select("id, name, price, duration_days, description, kind")
    .eq("gym_id", gym.id)
    .eq("is_active", true)
    .in("kind", ["membership", "personal_trainer"])
    .order("price", { ascending: true });
  const allPlans = (planRows ?? []) as (PlanOption & { kind: string })[];
  const plans = allPlans.filter((p) => p.kind !== "personal_trainer");
  const trainerPlans = allPlans.filter((p) => p.kind === "personal_trainer");

  // Pre-render a scan-to-pay UPI QR for every membership × trainer combination
  // (including "no trainer"), keyed "<membershipId>|<trainerId or ''>", so the QR
  // always encodes the exact total. Only when the gym has set a UPI ID.
  let upiQrByCombo: Record<string, string> = {};
  if (gym.upi_id) {
    const trainerOptions: (PlanOption | null)[] = [null, ...trainerPlans];
    const entries = await Promise.all(
      plans.flatMap((m) =>
        trainerOptions.map(async (pt) => {
          const amount = m.price + (pt?.price ?? 0);
          return [
            `${m.id}|${pt?.id ?? ""}`,
            await qrDataUrl(
              buildUpiUri({ vpa: gym.upi_id!, name: gym.upi_payee_name ?? gym.name, amount }),
            ),
          ] as const;
        }),
      ),
    );
    upiQrByCombo = Object.fromEntries(entries);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-4 py-10">
      <header className="flex items-center gap-3">
        {gym.logo_url ? (
          <Image
            src={gym.logo_url}
            alt={`${gym.name} logo`}
            width={56}
            height={56}
            className="size-14 rounded-lg object-cover"
            unoptimized
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold">{gym.name}</h1>
          <p className="text-sm text-muted-foreground">Membership registration</p>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
          This gym hasn’t published any membership plans yet. Please check back later or contact the gym
          directly.
        </div>
      ) : (
        <JoinForm
          token={token}
          plans={plans}
          trainerPlans={trainerPlans}
          upiId={gym.upi_id}
          upiPayeeName={gym.upi_payee_name ?? gym.name}
          upiQrByCombo={upiQrByCombo}
        />
      )}

      <p className="mt-auto pt-6 text-center text-xs text-muted-foreground">Powered by GymFlow Pro</p>
    </main>
  );
}
