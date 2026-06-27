import { redirect } from "next/navigation";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { MemberPhoto } from "@/components/members/member-photo";
import { RequestActions } from "@/components/join/request-actions";
import { DecidedRow } from "@/components/join/decided-row";
import { formatMoney, formatDate, formatSerial } from "@/lib/members/metrics";
import { methodLabel } from "@/lib/payments/invoice";
import type { JoinRequest } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function JoinRequestsPage() {
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) redirect("/dashboard");

  const { data: rows } = await ctx.supabase
    .from("join_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const all = (rows ?? []) as JoinRequest[];
  const pending = all.filter((r) => r.status === "pending");
  const decided = all.filter((r) => r.status !== "pending").slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Join requests</h1>
        <p className="text-sm text-muted-foreground">
          New members who registered via your QR code. Review the details and approve to add them.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card className="glass p-6 text-sm text-muted-foreground">No pending requests right now.</Card>
      ) : (
        <div className="space-y-4">
          {pending.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="space-y-2 pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recently decided</h2>
          <Card className="glass divide-y divide-border/40">
            {decided.map((r) => (
              <DecidedRow key={r.id} r={r} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function RequestCard({ r }: { r: JoinRequest }) {
  return (
    <Card className="glass space-y-4 p-5">
      <div className="flex items-start gap-4">
        <MemberPhoto name={r.full_name} photoUrl={r.photo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{r.full_name}</h3>
            <span className="font-mono text-xs text-muted-foreground">{formatSerial(r.serial)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {[r.phone, r.email].filter(Boolean).join(" · ") || "No contact info"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(r.created_at)}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">{r.plan_name ?? "—"}</div>
          {r.plan_price != null && (
            <div className="text-sm text-muted-foreground">{formatMoney(Number(r.plan_price))}</div>
          )}
          {r.pt_plan_id && (
            <div className="mt-1 text-sm">
              <div className="font-medium">+ PT · {r.pt_plan_name ?? "—"}</div>
              {r.pt_plan_price != null && (
                <div className="text-xs text-muted-foreground">{formatMoney(Number(r.pt_plan_price))}</div>
              )}
            </div>
          )}
          {r.pt_plan_id && (
            <div className="mt-1 border-t border-border/60 pt-1 text-sm font-semibold">
              Total {formatMoney(Number(r.plan_price ?? 0) + Number(r.pt_plan_price ?? 0))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{methodLabel(r.payment_method)}</div>
        </div>
      </div>

      <div className="grid gap-x-6 text-sm sm:grid-cols-2">
        <Detail label="Gender" value={r.gender} />
        <Detail label="Date of birth" value={r.date_of_birth ? formatDate(r.date_of_birth) : null} />
        <Detail label="Height" value={r.height_cm != null ? `${r.height_cm} cm` : null} />
        <Detail label="Weight" value={r.weight_kg != null ? `${r.weight_kg} kg` : null} />
        <Detail label="Address" value={r.address} />
        <Detail label="Notes" value={r.notes} />
      </div>

      {r.payment_method === "upi" && r.payment_proof_url && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Payment screenshot</p>
          <a href={r.payment_proof_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.payment_proof_url} alt="Payment proof" className="max-h-48 rounded-md border" />
          </a>
        </div>
      )}

      <RequestActions requestId={r.id} />
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-border/30 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}
