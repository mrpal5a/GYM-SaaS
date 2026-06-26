import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getGymBranding } from "@/lib/gym/branding";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [branding, ctx] = await Promise.all([getGymBranding(), getGymContext()]);
  const canManage = ctx ? canManageGym(ctx.role) : false;

  // Owners get a pending-join-request badge in the sidebar (RLS scopes the count).
  let pendingRequests = 0;
  if (ctx && canManage) {
    const { count } = await ctx.supabase
      .from("join_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingRequests = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar gymName={branding?.name} logoUrl={branding?.logoUrl} />
      <div className="flex flex-1 gap-4 p-4">
        <Sidebar canManage={canManage} pendingRequests={pendingRequests} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
