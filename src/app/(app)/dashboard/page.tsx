import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="glass p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your foundation is live. Member management arrives in Phase 1.
      </p>
    </Card>
  );
}
