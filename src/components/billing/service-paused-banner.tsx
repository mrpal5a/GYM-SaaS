"use client";
import { PhoneIcon, MessageCircleIcon } from "lucide-react";

/**
 * Full-width red scrolling (marquee) alert shown on a paused gym's dashboard.
 * Tells the owner their service is stopped and offers a call + WhatsApp contact.
 */
export function ServicePausedBanner({
  phone,
  whatsappHref,
}: {
  phone: string | null;
  whatsappHref: string | null;
}) {
  const message =
    "⚠ Your services have been stopped due to plan expiry. Please contact us immediately to continue your services.";

  return (
    <div className="overflow-hidden rounded-xl border border-red-600/50 bg-red-600 text-white shadow-sm">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        {/* Scrolling headline */}
        <div className="relative flex-1 overflow-hidden">
          <div className="gf-marquee flex w-max gap-12 whitespace-nowrap text-sm font-medium">
            <span>{message}</span>
            <span aria-hidden="true">{message}</span>
          </div>
        </div>

        {/* Contact actions */}
        <div className="flex shrink-0 items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              <PhoneIcon className="size-4" /> {phone}
            </a>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-white/90"
            >
              <MessageCircleIcon className="size-4" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes gf-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .gf-marquee { animation: gf-marquee-scroll 18s linear infinite; }
        .gf-marquee:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .gf-marquee { animation: none; } }
      `}</style>
    </div>
  );
}
