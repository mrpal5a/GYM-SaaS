import { InviteForm } from "@/components/auth/invite-form";
import { Card } from "@/components/ui/card";

export default function AcceptInvitePage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Accept your invite</h1>
        <p className="mb-6 text-sm text-muted-foreground">Set a password to join the gym.</p>
        <InviteForm />
      </Card>
    </main>
  );
}
