"use client";
import { ParamSelect } from "@/components/ui/param-select";

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
  return (
    <ParamSelect
      param="month"
      options={options}
      initial={initial}
      clearValue="all"
      aria-label="Filter by month"
    />
  );
}
