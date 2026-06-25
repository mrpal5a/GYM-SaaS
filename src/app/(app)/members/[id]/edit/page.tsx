import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MemberForm } from "@/components/members/member-form";
import { updateMemberAction } from "@/actions/members";
import type { Member } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("members").select("*").eq("id", id).single();
  if (!data) notFound();
  const member = data as Member;

  // Bind the member id so MemberForm sees a (prev, formData) action.
  const action = updateMemberAction.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={`/members/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Back to profile
      </Link>
      <Card className="glass p-6">
        <h1 className="mb-6 text-xl font-semibold">Edit {member.full_name}</h1>
        <MemberForm action={action} member={member} submitLabel="Save changes" />
      </Card>
    </div>
  );
}
