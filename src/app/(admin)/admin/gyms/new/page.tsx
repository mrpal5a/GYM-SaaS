import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardGymForm } from "@/components/admin/onboard-gym-form";

export default function NewGymPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Back to gyms</Link>
      <Card className="glass">
        <CardHeader>
          <CardTitle>Onboard a gym</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create the gym and its owner account. Share the email and password with the owner.
          </p>
        </CardHeader>
        <CardContent><OnboardGymForm /></CardContent>
      </Card>
    </div>
  );
}
