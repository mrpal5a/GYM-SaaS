import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Forgot your password?</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
        <ForgotPasswordForm />
      </Card>
    </main>
  );
}
