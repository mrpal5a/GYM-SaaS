import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="glass w-full max-w-md p-8">
        <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to GymFlow Pro.</p>
        <LoginForm />
      </Card>
    </main>
  );
}
