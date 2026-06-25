"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a one-shot success toast from a `?flash=` query param (set by a server
 * action before redirecting), then strips the param so a refresh won't repeat it.
 */
export function FlashToast({ message }: { message?: string }) {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (!message || shown.current) return;
    shown.current = true;
    toast.success(message);
    router.replace("/members");
  }, [message, router]);

  return null;
}
