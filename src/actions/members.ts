"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getGymContext } from "@/lib/auth/context";
import { memberSchema } from "@/lib/validations/member";

export type ActionResult = { ok: false; error: string } | { ok: true };

const PHOTO_BUCKET = "member-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Upload an optional member photo to storage; returns a public URL or null.
// Failure is non-fatal: the member still saves without a photo (so the feature
// degrades gracefully if the storage bucket isn't provisioned yet).
async function uploadPhoto(
  ctx: NonNullable<Awaited<ReturnType<typeof getGymContext>>>,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) return null;
  if (!file.type.startsWith("image/")) return null;

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${ctx.gymId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await ctx.supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("member photo upload failed:", error.message);
    return null;
  }
  const { data } = ctx.supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const photoUrl = await uploadPhoto(ctx, formData.get("photo") as File | null);

  const { error } = await ctx.supabase.from("members").insert({
    gym_id: ctx.gymId,
    created_by: ctx.userId,
    photo_url: photoUrl,
    ...parsed.data,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/members");
  revalidatePath("/dashboard");
  redirect("/members");
}

export async function updateMemberAction(
  memberId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const photoUrl = await uploadPhoto(ctx, formData.get("photo") as File | null);

  const update: Record<string, unknown> = { ...parsed.data };
  if (photoUrl) update.photo_url = photoUrl;

  // RLS confines this to the caller's gym; the explicit eq is defense in depth.
  const { error } = await ctx.supabase
    .from("members")
    .update(update)
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}`);
}

export async function deleteMemberAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  await ctx.supabase.from("members").delete().eq("id", memberId).eq("gym_id", ctx.gymId);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  redirect("/members");
}

export async function toggleMemberActiveAction(formData: FormData): Promise<void> {
  const ctx = await getGymContext();
  if (!ctx) return;
  const memberId = String(formData.get("memberId") ?? "");
  const next = String(formData.get("isActive") ?? "") === "true";
  if (!memberId) return;

  await ctx.supabase
    .from("members")
    .update({ is_active: next })
    .eq("id", memberId)
    .eq("gym_id", ctx.gymId);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
}
