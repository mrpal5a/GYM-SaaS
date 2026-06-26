"use server";
import { revalidatePath } from "next/cache";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { gymBrandingSchema, onboardingSettingsSchema } from "@/lib/validations/gym";

export type ActionResult = { ok: false; error: string } | { ok: true };

const LOGO_BUCKET = "gym-logos";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function updateGymBrandingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!canManageGym(ctx.role)) {
    return { ok: false, error: "Only the gym owner can change branding" };
  }

  const parsed = gymBrandingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const update: Record<string, unknown> = { name: parsed.data.name };

  const file = formData.get("logo") as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "Logo must be under 5 MB" };
    if (!file.type.startsWith("image/")) return { ok: false, error: "Logo must be an image" };

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${ctx.gymId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await ctx.supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadErr) return { ok: false, error: `Logo upload failed: ${uploadErr.message}` };
    update.logo_url = ctx.supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // RLS confines this to the caller's own, owner-managed gym; the eq is defense in depth.
  const { error } = await ctx.supabase
    .from("gyms")
    .update(update)
    .eq("id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateOnboardingSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getGymContext();
  if (!ctx) return { ok: false, error: "Not authorized" };
  if (!canManageGym(ctx.role)) {
    return { ok: false, error: "Only the gym owner can change onboarding settings" };
  }

  const parsed = onboardingSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // RLS confines this to the caller's own, owner-managed gym; the eq is defense in depth.
  const { error } = await ctx.supabase
    .from("gyms")
    .update({
      upi_id: parsed.data.upi_id ?? null,
      upi_payee_name: parsed.data.upi_payee_name ?? null,
    })
    .eq("id", ctx.gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
