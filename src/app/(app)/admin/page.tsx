import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <Card className="glass p-8">
      <h1 className="text-2xl font-semibold">Super Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cross-tenant administration arrives in Phase 8.
      </p>
    </Card>
  );
}
