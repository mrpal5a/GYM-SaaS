"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active,expiring", label: "Active memberships" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring soon" },
  { value: "expiring,expired", label: "Expiring + expired" },
  { value: "expired", label: "Expired" },
  { value: "none", label: "No plan" },
];

const SORT_OPTIONS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name: A → Z" },
  { value: "name_desc", label: "Name: Z → A" },
];

export function MembersToolbar({
  initialQuery,
  initialStatus,
  initialSort,
}: {
  initialQuery: string;
  initialStatus: string;
  initialSort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  // Debounced search-as-you-type
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      push(next);
    }, 300);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function onParam(param: string, value: string, clearValue = "") {
    const next = new URLSearchParams(params.toString());
    if (value && value !== clearValue) next.set(param, value);
    else next.delete(param);
    push(next);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="Search by name, phone, or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="sm:max-w-xs"
      />
      <Select
        defaultValue={initialStatus}
        onChange={(e) => onParam("status", e.target.value)}
        className="sm:max-w-44"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={initialSort}
        onChange={(e) => onParam("sort", e.target.value, "created_desc")}
        className="sm:max-w-44"
        aria-label="Sort members"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
