import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to GymFlow Pro.</p>
        {reset === "done" && (
          <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            Your password has been updated. Sign in with your new password.
          </p>
        )}
        {error === "reset_link" && (
          <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            That reset link is invalid or has expired. Please request a new one.
          </p>
        )}
        <LoginForm />
      </Card>
    </main>
  );
}
