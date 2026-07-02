import Link from "next/link";
import { ReceiptIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordPaymentForm } from "@/components/payments/record-payment-form";
import { MonthFilter } from "@/components/payments/month-filter";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { ParamSelect } from "@/components/ui/param-select";
import { formatDate, formatMoney, formatSerial } from "@/lib/members/metrics";
import { loadActors, actorLabel, paymentSourceLabel } from "@/lib/members/attribution";
import type { Payment } from "@/types/db";

export const dynamic = "force-dynamic";

function methodLabel(method: string): string {
  if (method === "bank_transfer") return "Bank transfer";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

// Filter the ledger by how each payment was recorded (matches payments.source).
const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "manual", label: "Recorded manually" },
  { value: "plan", label: "Recorded with plan" },
  { value: "join_approval", label: "On request approval" },
];

// Sort options → the column + direction applied to the query.
const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount: high → low" },
  { value: "amount_asc", label: "Amount: low → high" },
];
const SORT_COLUMNS: Record<string, { column: string; ascending: boolean }> = {
  date_desc: { column: "paid_at", ascending: false },
  date_asc: { column: "paid_at", ascending: true },
  amount_desc: { column: "amount", ascending: false },
  amount_asc: { column: "amount", ascending: true },
};

// Recent months (current month back 11) plus an "all time" option, for the filter.
function buildMonthOptions(now: Date): { value: string; label: string }[] {
  const options = [{ value: "all", label: "All time" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; source?: string; sort?: string }>;
}) {
  const { q = "", month = "", source = "", sort = "" } = await searchParams;
  const supabase = await createClient();

  // Source filter: null (= all) unless a known non-"all" value was passed.
  const selectedSource =
    SOURCE_OPTIONS.some((o) => o.value === source) && source !== "all" ? source : null;
  // Sort: fall back to newest-first for anything unrecognized.
  const selectedSort = SORT_COLUMNS[sort] ? sort : "date_desc";
  const sortConfig = SORT_COLUMNS[selectedSort];

  const now = new Date();
  const monthOptions = buildMonthOptions(now);

  // Parse the selected month (YYYY-MM). Anything invalid falls back to "all time".
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const selectedMonth =
    match && monthOptions.some((o) => o.value === month) ? month : "all";
  const hasMonth = selectedMonth !== "all";
  let monthStart: Date | null = null;
  let monthEnd: Date | null = null;
  let monthLabel = "";
  if (hasMonth) {
    const year = Number(match![1]);
    const monthIdx = Number(match![2]) - 1;
    monthStart = new Date(year, monthIdx, 1);
    monthEnd = new Date(year, monthIdx + 1, 1);
    monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  let paymentsQuery = supabase
    .from("payments")
    .select("*")
    .order(sortConfig.column, { ascending: sortConfig.ascending })
    .limit(200);

  if (monthStart && monthEnd) {
    paymentsQuery = paymentsQuery
      .gte("paid_at", monthStart.toISOString())
      .lt("paid_at", monthEnd.toISOString());
  }
  if (selectedSource) paymentsQuery = paymentsQuery.eq("source", selectedSource);

  // Search across invoice number, member name, and amount. A numeric term also
  // matches the exact amount; the % , ( ) strip keeps the PostgREST or() safe.
  const term = q.replace(/[%,()]/g, "").trim();
  if (term) {
    const filters = [`invoice_number.ilike.%${term}%`, `member_name.ilike.%${term}%`];
    const amount = Number(term);
    if (Number.isFinite(amount) && term !== "") filters.push(`amount.eq.${amount}`);
    paymentsQuery = paymentsQuery.or(filters.join(","));
  }

  // Revenue total for the selected scope stays accurate regardless of the search.
  let totalQuery = supabase.from("payments").select("amount");
  if (monthStart && monthEnd) {
    totalQuery = totalQuery
      .gte("paid_at", monthStart.toISOString())
      .lt("paid_at", monthEnd.toISOString());
  }
  if (selectedSource) totalQuery = totalQuery.eq("source", selectedSource);

  const [{ data: paymentsData }, { data: membersData }, { data: totalData }] = await Promise.all([
    paymentsQuery,
    supabase.from("members").select("id, full_name").order("full_name"),
    totalQuery,
  ]);
  const payments = (paymentsData ?? []) as Payment[];
  const members = (membersData ?? []) as { id: string; full_name: string }[];

  // Resolve who recorded each payment (one query) for the "Recorded by" column.
  const actors = await loadActors(supabase, payments.map((p) => p.created_by));

  const revenueTotal = (totalData ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const revenueLabel = hasMonth ? `${monthLabel} revenue` : "All-time revenue";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {hasMonth ? `Showing ${monthLabel}` : "Showing all time"} ·{" "}
          {term
            ? `${payments.length} ${payments.length === 1 ? "match" : "matches"}`
            : `${payments.length} records`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchToolbar initialQuery={q} placeholder="Search by invoice #, member name, or amount…" />
              <MonthFilter options={monthOptions} initial={selectedMonth} />
              <ParamSelect
                param="source"
                options={SOURCE_OPTIONS}
                initial={selectedSource ?? "all"}
                clearValue="all"
                aria-label="Filter by source"
              />
              <ParamSelect
                param="sort"
                options={SORT_OPTIONS}
                initial={selectedSort}
                clearValue="date_desc"
                aria-label="Sort payments"
              />
            </div>
            <Card className="glass shrink-0 px-4 py-2">
              <p className="text-xs text-muted-foreground">{revenueLabel}</p>
              <p className="text-lg font-semibold tracking-tight">{formatMoney(revenueTotal)}</p>
            </Card>
          </div>
          {payments.length === 0 ? (
            <Card className="glass flex flex-col items-center gap-3 p-12 text-center">
              <ReceiptIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{term ? "No matching payments" : "No payments yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {term
                    ? "Try a different invoice number, member name, or amount."
                    : "Record your first payment using the form."}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="glass overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Recorded by</th>
                      <th className="px-4 py-3 font-medium">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatSerial(p.serial)}
                        </td>
                        <td className="px-4 py-3">{formatDate(p.paid_at.slice(0, 10))}</td>
                        <td className="px-4 py-3">
                          {p.member_id ? (
                            <Link href={`/members/${p.member_id}`} className="hover:underline">
                              {p.member_name || "—"}
                            </Link>
                          ) : (
                            p.member_name || "—"
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{formatMoney(Number(p.amount))}</td>
                        <td className="px-4 py-3 text-muted-foreground">{methodLabel(p.method)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="text-foreground">{actorLabel(actors.get(p.created_by ?? ""))}</span>
                          <span className="block text-xs">{paymentSourceLabel(p.source)}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <Link href={`/invoice/${p.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                            {p.invoice_number || "View"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <Card className="glass h-fit">
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a member first to record payments.
              </p>
            ) : (
              <RecordPaymentForm members={members} compact />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
