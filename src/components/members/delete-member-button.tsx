"use client";
import { Button } from "@/components/ui/button";
import { deleteMemberAction } from "@/actions/members";
import { Trash2Icon } from "lucide-react";

export function DeleteMemberButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <form
      action={deleteMemberAction}
      onSubmit={(e) => {
        if (!confirm(`Delete ${name}? This also removes their memberships and unlinks payments. This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="memberId" value={memberId} />
      <Button type="submit" variant="destructive" size="sm">
        <Trash2Icon /> Delete
      </Button>
    </form>
  );
}
