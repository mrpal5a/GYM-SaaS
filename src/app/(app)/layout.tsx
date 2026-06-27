import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { RequestsPoller } from "@/components/layout/requests-poller";
import { getGymBranding } from "@/lib/gym/branding";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A super_admin has no gym; send them to their console instead of an empty shell.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims?.user_role === "super_admin") redirect("/admin");

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
      {canManage && <RequestsPoller />}
      <Topbar
        gymName={branding?.name}
        logoUrl={branding?.logoUrl}
        canManage={canManage}
        pendingRequests={pendingRequests}
      />
      <div className="flex flex-1 gap-4 p-4">
        <Sidebar canManage={canManage} pendingRequests={pendingRequests} />
        <main className="min-w-0 flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
