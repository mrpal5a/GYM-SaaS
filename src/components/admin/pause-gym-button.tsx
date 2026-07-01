"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PauseIcon, PlayIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminSetGymPausedAction } from "@/actions/admin";

/**
 * Super-admin toggle to pause/resume a gym's service. Pausing blocks the gym's
 * owner + staff from the app until resumed. Confirms before pausing.
 */
export function PauseGymButton({
  gymId,
  gymName,
  paused,
}: {
  gymId: string;
  gymName: string;
  paused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!paused && !confirm(`Pause service for ${gymName}? Their team will be locked out until you resume.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await adminSetGymPausedAction(gymId, !paused);
      if (res.ok) {
        toast.success(paused ? `${gymName} resumed` : `${gymName} paused`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Couldn't update the gym. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className={paused ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
    >
      {busy ? (
        <Loader2Icon className="animate-spin" />
      ) : paused ? (
        <PlayIcon />
      ) : (
        <PauseIcon />
      )}
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}
