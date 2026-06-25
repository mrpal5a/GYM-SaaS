import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GymBrandingForm } from "@/components/settings/gym-branding-form";
import { getGymContext } from "@/lib/auth/context";
import { getGymBranding } from "@/lib/gym/branding";
import { canManageGym } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) redirect("/dashboard");

  const branding = await getGymBranding();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your gym&apos;s branding.</p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <GymBrandingForm name={branding?.name ?? ""} logoUrl={branding?.logoUrl ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
