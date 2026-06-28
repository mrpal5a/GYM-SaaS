import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Set a new password</h1>
        <p className="mb-6 text-sm text-muted-foreground">Choose a new password for your account.</p>
        <ResetPasswordForm />
      </Card>
    </main>
  );
}
