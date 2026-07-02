"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";

export type ActionResult = { ok: false; error: string } | { ok: true };
export type CreateGroupResult =
  | { ok: false; error: string }
  | { ok: true; groupId: string };

// Refresh every list/page that shows group membership after a change.
function revalidateGroups(memberId?: string) {
  revalidatePath("/groups");
  revalidatePath("/members");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

/**
 * Start a group seeded from a single member. The group is auto-named after that
 * member ("Group of Rohan Nair") and the member is attached to it. Returns the new
 * group id so the caller can immediately add others to it. RLS confines everything
 * to the caller's gym; the explicit gym eq is defense in depth.
 */
export async function createGroupForMemberAction(memberId: string): Promise<CreateGroupResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!memberId) return { ok: false, error: "Missing member." };

  const { data: member } = await ctx.supabase
    .from("members")
    .select("full_name, group_id")
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!member) return { ok: false, error: "Member not found." };
  if (member.group_id) return { ok: false, error: "This member is already in a group." };

  const { data: group, error } = await ctx.supabase
    .from("member_groups")
    .insert({ gym_id: ctx.gymId, name: `Group of ${member.full_name}`, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !group) return { ok: false, error: error?.message ?? "Couldn't create the group." };

  const { error: linkErr } = await ctx.supabase
    .from("members")
    .update({ group_id: group.id })
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId);
  if (linkErr) return { ok: false, error: linkErr.message };

  revalidateGroups(memberId);
  return { ok: true, groupId: group.id };
}

/** Rename a group (e.g. from the auto-name to "Sharma family"). */
export async function renameGroupAction(groupId: string, name: string): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  const trimmed = name.trim();
  if (!groupId) return { ok: false, error: "Missing group." };
  if (!trimmed) return { ok: false, error: "Name can't be empty." };
  if (trimmed.length > 120) return { ok: false, error: "Name is too long." };

  const { error } = await ctx.supabase
    .from("member_groups")
    .update({ name: trimmed })
    .eq("id", groupId)
    .eq("gym_id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidateGroups();
  return { ok: true };
}

/**
 * Delete a group. Members are not deleted — the FK is `on delete set null`, so they
 * simply become ungrouped.
 */
export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!groupId) return { ok: false, error: "Missing group." };

  const { error } = await ctx.supabase
    .from("member_groups")
    .delete()
    .eq("id", groupId)
    .eq("gym_id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidateGroups();
  return { ok: true };
}

/** Attach an existing member to an existing group (both in the caller's gym). */
export async function addMemberToGroupAction(
  groupId: string,
  memberId: string,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!groupId || !memberId) return { ok: false, error: "Missing group or member." };

  // The group must belong to this gym (RLS enforces it; the lookup gives a clear error).
  const { data: group } = await ctx.supabase
    .from("member_groups")
    .select("id")
    .eq("id", groupId)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!group) return { ok: false, error: "Group not found." };

  const { error } = await ctx.supabase
    .from("members")
    .update({ group_id: groupId })
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidateGroups(memberId);
  return { ok: true };
}

/**
 * Detach a member from their group. If that leaves the group empty, delete the now-
 * orphaned group so stale empty groups don't pile up.
 */
export async function removeMemberFromGroupAction(memberId: string): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!memberId) return { ok: false, error: "Missing member." };

  const { data: member } = await ctx.supabase
    .from("members")
    .select("group_id")
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId)
    .single();
  if (!member) return { ok: false, error: "Member not found." };
  const groupId = member.group_id;

  const { error } = await ctx.supabase
    .from("members")
    .update({ group_id: null })
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  // Clean up the group if it's now empty.
  if (groupId) {
    const { count } = await ctx.supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if ((count ?? 0) === 0) {
      await ctx.supabase.from("member_groups").delete().eq("id", groupId).eq("gym_id", ctx.gymId);
    }
  }

  revalidateGroups(memberId);
  return { ok: true };
}
