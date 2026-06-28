"use client";
import { Button } from "@/components/ui/button";
import { DeletePasswordDialog } from "@/components/ui/delete-password-dialog";
import { deleteMemberAction } from "@/actions/members";
import { Trash2Icon } from "lucide-react";

export function DeleteMemberButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <DeletePasswordDialog
      action={deleteMemberAction}
      hiddenFields={{ memberId }}
      title={`Delete ${name}?`}
      description="This also removes their memberships and unlinks payments. This cannot be undone."
      trigger={
        <Button type="button" variant="destructive" size="sm">
          <Trash2Icon /> Delete
        </Button>
      }
    />
  );
}
