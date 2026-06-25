import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MemberForm } from "@/components/members/member-form";
import { createMemberAction } from "@/actions/members";

export default function NewMemberPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Back to members
      </Link>
      <Card className="glass p-6">
        <h1 className="mb-1 text-xl font-semibold">Add member</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Create a new member profile. You can assign a plan afterwards.
        </p>
        <MemberForm action={createMemberAction} submitLabel="Create member" />
      </Card>
    </div>
  );
}
