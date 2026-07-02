import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { RequestsPoller } from "@/components/layout/requests-poller";
import { ServicePausedBanner } from "@/components/billing/service-paused-banner";
import { getGymBranding } from "@/lib/gym/branding";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym, canReviewRequests } from "@/lib/auth/roles";
import { currentGymPaused } from "@/lib/billing/pause";
import { buildSupportWhatsappLink, supportPhone } from "@/lib/billing/support-link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A super_admin has no gym; send them to their console instead of an empty shell.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims?.user_role === "super_admin") redirect("/admin");

  const [branding, ctx, paused] = await Promise.all([
    getGymBranding(),
    getGymContext(),
    currentGymPaused(),
  ]);
  const canManage = ctx ? canManageGym(ctx.role) : false;
  // Staff can review join requests too (approve/reject), so they get the Requests
  // nav item, the pending badge, and the poller — but not owner-only Settings.
  const canReview = ctx ? canReviewRequests(ctx.role) : false;

  // When paused, the owner keeps only the dashboard (with the alert below); the
  // proxy redirects every other route here. Build the support contacts once.
  const supportPhoneNumber = supportPhone();
  const supportWhatsapp = buildSupportWhatsappLink(
    `Hi, my GymFlow service is paused for ${branding?.name ?? "my gym"} — I'd like to renew and continue.`,
  );

  // Owners + staff get a pending-join-request badge in the sidebar (RLS scopes the count).
  let pendingRequests = 0;
  if (ctx && canReview) {
    const { count } = await ctx.supabase
      .from("join_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingRequests = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {canReview && <RequestsPoller />}
      <Topbar
        gymName={branding?.name}
        logoUrl={branding?.logoUrl}
        canManage={canManage}
        canReview={canReview}
        pendingRequests={pendingRequests}
      />
      <div className="flex flex-1 gap-4 p-4">
        <Sidebar canManage={canManage} canReview={canReview} pendingRequests={pendingRequests} />
        <main className="min-w-0 flex-1 space-y-4">
          {paused && (
            <ServicePausedBanner phone={supportPhoneNumber} whatsappHref={supportWhatsapp} />
          )}
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
