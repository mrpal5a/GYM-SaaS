import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GymBrandingForm } from "@/components/settings/gym-branding-form";
import { OnboardingSettings } from "@/components/settings/onboarding-settings";
import { getGymContext } from "@/lib/auth/context";
import { getGymBranding } from "@/lib/gym/branding";
import { canManageGym } from "@/lib/auth/roles";
import { buildJoinUrl, qrDataUrl } from "@/lib/gym/join-link";
import type { Gym } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) redirect("/dashboard");

  const [branding, { data: gymRow }] = await Promise.all([
    getGymBranding(),
    ctx.supabase
      .from("gyms")
      .select("join_token, upi_id, upi_payee_name")
      .eq("id", ctx.gymId)
      .single<Pick<Gym, "join_token" | "upi_id" | "upi_payee_name">>(),
  ]);

  const joinUrl = gymRow?.join_token ? buildJoinUrl(gymRow.join_token) : null;
  const joinQr = joinUrl ? await qrDataUrl(joinUrl) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your gym&apos;s branding and member onboarding.</p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <GymBrandingForm name={branding?.name ?? ""} logoUrl={branding?.logoUrl ?? null} />
        </CardContent>
      </Card>

      {joinUrl && joinQr && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Member self-onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <OnboardingSettings
              joinUrl={joinUrl}
              joinQr={joinQr}
              upiId={gymRow?.upi_id ?? ""}
              upiPayeeName={gymRow?.upi_payee_name ?? ""}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
