"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

/**
 * A native <select> that drives a single URL search param (search-param-as-state).
 * Selecting `clearValue` removes the param entirely so the URL stays clean on the
 * default choice. Server pages read the param and filter/sort accordingly. Shared
 * by the payments source/sort filters, the month filter, and the members sort.
 */
export function ParamSelect({
  param,
  options,
  initial,
  clearValue,
  className = "sm:max-w-44",
  "aria-label": ariaLabel,
}: {
  param: string;
  options: { value: string; label: string }[];
  initial: string;
  /** The value that clears the param (e.g. "all" or the default sort). */
  clearValue?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== clearValue) next.set(param, value);
    else next.delete(param);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <Select
      defaultValue={initial}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
