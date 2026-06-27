import Link from "next/link";
import { BuildingIcon, UsersIcon, IndianRupeeIcon, DownloadIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ExpiryBadge } from "@/components/admin/expiry-badge";
import { getGymOverview } from "@/lib/admin/overview";
import { formatMoney } from "@/lib/members/metrics";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "primary"> = {
  active: "success", trialing: "primary", past_due: "warning", canceled: "danger",
};

export default async function AdminDashboardPage() {
  const gyms = (await getGymOverview()) ?? [];

  const totalMembers = gyms.reduce((s, g) => s + g.member_count, 0);
  const totalRevenue = gyms.reduce((s, g) => s + g.revenue_total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Gyms</h1>
          <p className="text-sm text-muted-foreground">Every gym using GymFlow Pro.</p>
        </div>
        <Link href="/admin/gyms/new" className={buttonVariants({ variant: "default" })}>
          Onboard gym
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gyms" value={gyms.length} icon={BuildingIcon} />
        <StatCard label="Active members" value={totalMembers} icon={UsersIcon} />
        <StatCard label="Total revenue" value={formatMoney(totalRevenue)} icon={IndianRupeeIcon} />
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>All gyms</CardTitle></CardHeader>
        <CardContent>
          {gyms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gyms yet. Onboard your first gym.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Gym</th>
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 text-right font-medium">Members</th>
                    <th className="py-2 pr-3 text-right font-medium">Revenue (mo / total)</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">SaaS expiry</th>
                    <th className="py-2 pr-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gyms.map((g) => (
                    <tr key={g.gym_id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/gyms/${g.gym_id}`} className="font-medium hover:underline">
                          {g.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="truncate">{g.owner_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{g.owner_email ?? "—"}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{g.member_count}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatMoney(g.revenue_this_month)}
                        <span className="text-muted-foreground"> / {formatMoney(g.revenue_total)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {g.plan ? <Badge tone={STATUS_TONE[g.status ?? "muted"] ?? "muted"}>{g.plan}</Badge> : "—"}
                      </td>
                      <td className="py-2.5 pr-3"><ExpiryBadge periodEnd={g.current_period_end} /></td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/gyms/${g.gym_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Manage
                          </Link>
                          <a href={`/admin/gyms/${g.gym_id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            <DownloadIcon /> Data
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
