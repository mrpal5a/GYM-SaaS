"use client";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { MemberAvatar } from "@/components/members/member-avatar";
import { MemberPhoto } from "@/components/members/member-photo";
import { formatDate, formatMoney, formatSerial } from "@/lib/members/metrics";
import { methodLabel } from "@/lib/payments/invoice";
import { cn } from "@/lib/utils";
import type { JoinRequest } from "@/types/db";

/**
 * A row in the "Recently decided" list. Approved requests render as a static row
 * (the person is now a member, viewable under Members). Rejected requests have no
 * member record, so the row is clickable to expand the full submitted details +
 * rejection reason — the only place that data survives.
 */
export function DecidedRow({ r }: { r: JoinRequest }) {
  const [open, setOpen] = useState(false);

  if (r.status !== "rejected") {
    return (
      <div className="flex items-center gap-3 p-3 text-sm">
        <MemberPhoto name={r.full_name} photoUrl={r.photo_url} size="sm" />
        <span className="font-mono text-xs text-muted-foreground">{formatSerial(r.serial)}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{r.full_name}</span>
        {r.plan_name && <span className="hidden text-xs text-muted-foreground sm:inline">{r.plan_name}</span>}
        <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-600 capitalize dark:text-emerald-400">
          {r.status}
        </span>
      </div>
    );
  }

  return (
    <div className="text-sm">
      {/* Plain (non-clickable) avatar here so we don't nest a <button> (MemberPhoto)
          inside this row <button> — that's invalid HTML. The zoomable photo lives in
          the expanded panel below. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-foreground/5"
      >
        <MemberAvatar name={r.full_name} photoUrl={r.photo_url} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-mono text-xs text-muted-foreground">{formatSerial(r.serial)}</span>
            <span className="truncate font-medium">{r.full_name}</span>
            {r.plan_name && <span className="text-xs text-muted-foreground">{r.plan_name}</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-medium">Reason:</span> {r.rejection_reason || "No reason given"}
          </p>
        </div>
        <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive capitalize">
          {r.status}
        </span>
        <ChevronDownIcon
          className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-border/40 px-3 pt-3 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <MemberPhoto name={r.full_name} photoUrl={r.photo_url} size="lg" />
            <span className="text-xs text-muted-foreground">
              {r.photo_url ? "Click photo to enlarge" : "No photo provided"}
            </span>
          </div>

          <div className="grid gap-x-6 sm:grid-cols-2">
            <Detail label="Phone" value={r.phone} />
            <Detail label="Email" value={r.email} />
            <Detail label="Gender" value={r.gender ? cap(r.gender) : null} />
            <Detail label="Date of birth" value={r.date_of_birth ? formatDate(r.date_of_birth) : null} />
            <Detail label="Height" value={r.height_cm != null ? `${r.height_cm} cm` : null} />
            <Detail label="Weight" value={r.weight_kg != null ? `${r.weight_kg} kg` : null} />
            <Detail label="Address" value={r.address} />
            <Detail
              label="Payment"
              value={`${methodLabel(r.payment_method)}${
                r.plan_price != null
                  ? ` · ${formatMoney(Number(r.plan_price) + Number(r.pt_plan_price ?? 0))}`
                  : ""
              }`}
            />
            {r.pt_plan_id && (
              <Detail label="Personal Trainer" value={r.pt_plan_name ?? "—"} />
            )}
            <Detail label="Submitted" value={formatDate(r.created_at)} />
            <Detail label="Reviewed" value={r.reviewed_at ? formatDate(r.reviewed_at) : null} />
          </div>

          {r.notes && (
            <div className="mt-2 border-t border-border/30 pt-2">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p>{r.notes}</p>
            </div>
          )}

          {r.payment_method === "upi" && r.payment_proof_url && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Payment screenshot</p>
              <a href={r.payment_proof_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.payment_proof_url} alt="Payment proof" className="max-h-48 rounded-md border" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-border/30 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
