import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubscriptionEditor } from "@/components/admin/subscription-editor";
import { getAdminContext } from "@/lib/auth/admin-context";
import { formatMoney } from "@/lib/members/metrics";
import type { Gym, Subscription } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminGymDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) notFound();

  const [{ data: gym }, { data: sub }, { count: memberCount }, { data: payments }] = await Promise.all([
    ctx.supabase.from("gyms").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("subscriptions").select("*").eq("gym_id", id).maybeSingle(),
    ctx.supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", id).eq("is_active", true),
    ctx.supabase.from("payments").select("amount").eq("gym_id", id),
  ]);

  if (!gym) notFound();
  const g = gym as Gym;
  const revenueTotal = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Back to gyms</Link>

      <Card className="glass">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>{g.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{g.slug}</p>
          </div>
          <a href={`/admin/gyms/${id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <DownloadIcon /> Download data
          </a>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Active members:</span> {memberCount ?? 0}</div>
          <div><span className="text-muted-foreground">Total revenue:</span> {formatMoney(revenueTotal)}</div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>SaaS subscription</CardTitle></CardHeader>
        <CardContent>
          <SubscriptionEditor gymId={id} sub={(sub as Subscription | null) ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
