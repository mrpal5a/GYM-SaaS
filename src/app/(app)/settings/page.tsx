import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GymBrandingForm } from "@/components/settings/gym-branding-form";
import { GymRulesForm } from "@/components/settings/gym-rules-form";
import { OnboardingSettings } from "@/components/settings/onboarding-settings";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { StaffManager, type StaffRow } from "@/components/settings/staff-manager";
import { getGymContext } from "@/lib/auth/context";
import { getGymBranding } from "@/lib/gym/branding";
import { canManageGym } from "@/lib/auth/roles";
import { buildJoinUrl, qrDataUrl } from "@/lib/gym/join-link";
import type { Gym } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) redirect("/dashboard");

  const [branding, { data: gymRow }, { data: peopleRows }] = await Promise.all([
    getGymBranding(),
    ctx.supabase
      .from("gyms")
      .select("join_token, upi_id, upi_payee_name")
      .eq("id", ctx.gymId)
      .single<Pick<Gym, "join_token" | "upi_id" | "upi_payee_name">>(),
    // Team = owner(s) + staff of this gym (RLS scopes it). Owners sort first.
    ctx.supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("gym_id", ctx.gymId)
      .order("role")
      .order("created_at"),
  ]);
  const people = (peopleRows ?? []) as StaffRow[];

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
          <GymBrandingForm
            name={branding?.name ?? ""}
            logoUrl={branding?.logoUrl ?? null}
            address={branding?.address ?? null}
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Joining form rules</CardTitle>
        </CardHeader>
        <CardContent>
          <GymRulesForm rules={branding?.rules ?? []} />
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

      <Card className="glass">
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffManager people={people} selfId={ctx.userId} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
