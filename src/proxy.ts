import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// `/api/cron` is guarded by its own CRON_SECRET (not a session), so it must be
// reachable without a logged-in user.
const PUBLIC = ["/login", "/accept-invite", "/join", "/forgot-password", "/reset-password", "/auth/confirm", "/api/cron"];

// App routes a paused gym is locked out of — everything except the dashboard,
// which shows the "service paused" contact banner.
const PAUSE_GATED = ["/members", "/groups", "/archived", "/payments", "/renewals", "/plans", "/settings", "/join-requests", "/invoice"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  try {
    const { response, user, supabase } = await updateSession(request);

    if (!user && !isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user && path.startsWith("/admin")) {
      const { data } = await supabase.auth.getClaims();
      if (data?.claims?.user_role !== "super_admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    // Paused gyms: allow only the dashboard. Check just for gated routes (keeps the
    // extra query off the dashboard, assets, and auth pages).
    if (user && PAUSE_GATED.some((p) => path.startsWith(p))) {
      const { data } = await supabase.auth.getClaims();
      const gymId = data?.claims?.gym_id as string | undefined;
      if (gymId && data?.claims?.user_role !== "super_admin") {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("paused_at")
          .eq("gym_id", gymId)
          .maybeSingle();
        if (sub?.paused_at) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
    return response;
  } catch (e) {
    // If auth/session handling fails (e.g. Supabase transiently unreachable), never
    // 500 the whole app. Fail safe: let public routes through, and send everything
    // else to /login (which is public) rather than exposing a protected page.
    console.error("[proxy] session handling failed:", e instanceof Error ? e.message : e);
    if (isPublic) return NextResponse.next({ request });
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
