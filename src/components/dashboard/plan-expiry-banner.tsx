import { AlertTriangleIcon, MessageCircleIcon } from "lucide-react";
import type { PlanBannerSeverity } from "@/lib/billing/plan-status";
import { cn } from "@/lib/utils";

/**
 * Red marquee strip warning a gym owner that their SaaS plan is expiring or has
 * lapsed, with an optional WhatsApp button to start a renewal chat. Presentational
 * only — the page decides whether to render it and supplies the copy + link.
 */
export function PlanExpiryBanner({
  severity,
  message,
  whatsappHref,
}: {
  severity: PlanBannerSeverity;
  message: string;
  whatsappHref: string | null;
}) {
  const expired = severity === "expired";
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        expired
          ? "border-red-800/50 bg-red-600 text-white dark:bg-red-700"
          : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      <AlertTriangleIcon className="size-5 shrink-0" />
      <div className="marquee min-w-0 flex-1">
        <span className="marquee-track text-sm font-semibold">{message}</span>
      </div>
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            expired
              ? "bg-white text-red-700 hover:bg-white/90"
              : "bg-red-600 text-white hover:bg-red-700",
          )}
        >
          <MessageCircleIcon className="size-4" />
          <span className="whitespace-nowrap">Renew on WhatsApp</span>
        </a>
      )}
    </div>
  );
}
