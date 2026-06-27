"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateGymRulesAction } from "@/actions/gym";
import { DEFAULT_GYM_RULES } from "@/lib/gym/default-rules";

export function GymRulesForm({ rules }: { rules: string[] }) {
  const [state, action, pending] = useActionState(updateGymRulesAction, null);
  // Seed with presets the first time (no rules saved yet) so owners start from
  // sensible defaults; otherwise show what's saved.
  const [items, setItems] = useState<string[]>(rules.length > 0 ? rules : DEFAULT_GYM_RULES);

  useEffect(() => {
    if (state?.ok) toast.success("Gym rules saved");
  }, [state]);

  function update(index: number, value: string) {
    setItems((prev) => prev.map((r, i) => (i === index ? value : r)));
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function add() {
    setItems((prev) => [...prev, ""]);
  }

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These appear on every member&apos;s joining form. Add the rules specific to your gym.
      </p>
      <div className="space-y-2">
        {items.map((rule, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}.</span>
            <Input
              name="rules"
              value={rule}
              maxLength={200}
              onChange={(e) => update(i, e.target.value)}
              placeholder="e.g. Always carry a towel"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              aria-label={`Remove rule ${i + 1}`}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <PlusIcon /> Add rule
      </Button>
      {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="border-t border-border/40 pt-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save rules"}
        </Button>
      </div>
    </form>
  );
}
