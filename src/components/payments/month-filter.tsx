"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

/**
 * Drives a `?month=YYYY-MM` URL param (or `all`) so the payments list and its
 * revenue KPI can be scoped to a single month. Options are generated on the
 * server and passed in to keep the rendered markup stable between server/client.
 */
export function MonthFilter({
  options,
  initial,
}: {
  options: { value: string; label: string }[];
  initial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set("month", value);
    else next.delete("month");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <Select
      defaultValue={initial}
      onChange={(e) => onChange(e.target.value)}
      className="sm:max-w-44"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
