"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGymContext } from "@/lib/auth/context";
import { canManageGym } from "@/lib/auth/roles";
import { generateInvoiceNumber } from "@/lib/payments/invoice";
import { loadInvoiceData } from "@/lib/payments/invoice-data";
import { deliverInvoice, type InvoiceDelivery } from "@/lib/payments/invoice-delivery";
import { checkJoinRateLimit, getClientIp } from "@/lib/rate-limit/join";
import { joinRequestSchema } from "@/lib/validations/join";

export type JoinResult = { ok: true } | { ok: false; error: string };
export type ReviewResult = { ok: true } | { ok: false; error: string };
/** Approval also auto-delivers the invoice; `delivery` is null when no payment was created. */
export type ApproveResult =
  | { ok: true; delivery: InvoiceDelivery | null }
  | { ok: false; error: string };

const UPLOAD_BUCKET = "join-uploads";
// Safety net only — the client compresses photos/proofs to tens of KB before
// upload. This caps a failed/bypassed compression so one bad file can't balloon
// the free 1 GB of storage.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Best-effort removal of a request's uploaded images from join-uploads. Used once
 * a request is decided: the payment proof is a one-time verification artifact, and
 * a rejected request's photo is no longer needed. Never throws — a storage hiccup
 * must not fail the approve/reject it follows. (Approved members keep their photo,
 * which the member row references by URL, so we never delete that one.)
 */
async function removeJoinUploads(gymId: string, requestId: string, keys: Array<"photo" | "proof">) {
  try {
    const admin = createAdminClient();
    await admin.storage.from(UPLOAD_BUCKET).remove(keys.map((k) => `${gymId}/${requestId}/${k}`));
  } catch {
    // ignore — the row is already decided; orphaned files can be swept later.
  }
}

// Upload a prospect-supplied image to the public join-uploads bucket via the
// service-role client (the prospect is unauthenticated). Returns a public URL, or
// null when the file is missing/oversized/not an image. Returns the string "error"
// when the storage call itself fails so the caller can abort.
async function uploadImage(
  admin: Admin,
  path: string,
  file: File | null,
): Promise<string | null | "error"> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) return "error";
  if (!file.type.startsWith("image/")) return "error";
  const { error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return "error";
  return admin.storage.from(UPLOAD_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Public, unauthenticated submission of a join request. The gym is resolved from
 * the unguessable `join_token` in the URL; everything is written with the
 * service-role client (no JWT exists), always scoped to that one gym. The plan is
 * re-validated against the gym's active plans and its price snapshotted, so the
 * prospect can't pick another gym's plan or spoof the amount.
 */
export async function submitJoinRequestAction(
  token: string,
  _prev: unknown,
  formData: FormData,
): Promise<JoinResult> {
  if (!token) return { ok: false, error: "Invalid join link." };
  const admin = createAdminClient();

  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("join_token", token)
    .single();
  if (!gym) return { ok: false, error: "This join link is no longer valid." };

  // Throttle before any parsing/uploads so a flood costs only one indexed lookup.
  const allowed = await checkJoinRateLimit(admin, gym.id, await getClientIp());
  if (!allowed) {
    return { ok: false, error: "Too many requests from your network. Please try again later." };
  }

  const parsed = joinRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { plan_id, payment_method, ...member } = parsed.data;

  // The plan must be an active plan of THIS gym; snapshot its name + price.
  const { data: plan } = await admin
    .from("membership_plans")
    .select("name, price, is_active")
    .eq("id", plan_id)
    .eq("gym_id", gym.id)
    .single();
  if (!plan || !plan.is_active) {
    return { ok: false, error: "The selected plan isn't available. Please pick another." };
  }

  const proofFile = formData.get("payment_proof") as File | null;
  if (payment_method === "upi" && (!proofFile || proofFile.size === 0)) {
    return { ok: false, error: "Please attach a screenshot of your UPI payment." };
  }

  // Stable id so storage paths and the row share it; "<gym>/<request>/...".
  const requestId = crypto.randomUUID();

  const photoUrl = await uploadImage(
    admin,
    `${gym.id}/${requestId}/photo`,
    formData.get("photo") as File | null,
  );
  if (photoUrl === "error") return { ok: false, error: "Your photo couldn't be uploaded (use a JPG/PNG under 5 MB)." };

  const proofUrl = await uploadImage(admin, `${gym.id}/${requestId}/proof`, proofFile);
  if (proofUrl === "error") return { ok: false, error: "Your payment screenshot couldn't be uploaded (use a JPG/PNG under 5 MB)." };

  const { error } = await admin.from("join_requests").insert({
    id: requestId,
    gym_id: gym.id,
    ...member,
    photo_url: photoUrl,
    plan_id,
    plan_name: plan.name,
    plan_price: plan.price,
    payment_method,
    payment_proof_url: proofUrl,
  });
  if (error) return { ok: false, error: "Something went wrong submitting your request. Please try again." };

  // Refresh the owner's queue + dashboard count.
  revalidatePath("/join-requests");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Owner approves a pending request → materializes the member + plan + payment via
 * the transactional `approve_join_request` RPC (which re-checks gym + owner role +
 * pending status). The invoice number is generated here to match other payments.
 */
export async function approveJoinRequestAction(requestId: string): Promise<ApproveResult> {
  if (!requestId) return { ok: false, error: "Missing request." };
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) {
    return { ok: false, error: "Only the gym owner can approve requests." };
  }

  // Generate the invoice number here so we can find the payment the RPC creates
  // (invoice_number is unique to the second) and deliver its invoice afterward.
  const invoiceNumber = generateInvoiceNumber();
  const { error } = await ctx.supabase.rpc("approve_join_request", {
    p_request_id: requestId,
    p_invoice_number: invoiceNumber,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/renewals");
  revalidatePath("/join-requests");

  // The payment proof has served its purpose (the owner just approved) — drop it
  // so verification screenshots don't accumulate in storage. Keep the photo: the
  // new member references it.
  await removeJoinUploads(ctx.gymId, requestId, ["proof"]);

  // Auto-deliver the welcome message + invoice. Best-effort: the member is already
  // approved, so a send hiccup is reported but never rolls anything back.
  let delivery: InvoiceDelivery | null = null;
  try {
    const { data: payRow } = await ctx.supabase
      .from("payments")
      .select("id")
      .eq("gym_id", ctx.gymId)
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();
    if (payRow?.id) {
      const data = await loadInvoiceData(payRow.id, ctx);
      if (data) delivery = await deliverInvoice(data);
    }
  } catch {
    // Swallow — approval succeeded; the owner can re-send from the invoice page.
  }

  return { ok: true, delivery };
}

/** Owner rejects a pending request (optionally with a reason). No member is created. */
export async function rejectJoinRequestAction(
  requestId: string,
  reason: string,
): Promise<ReviewResult> {
  if (!requestId) return { ok: false, error: "Missing request." };
  const ctx = await getGymContext();
  if (!ctx || !canManageGym(ctx.role)) {
    return { ok: false, error: "Only the gym owner can reject requests." };
  }

  // RLS (owner-only update policy) is the real boundary; the eqs are defense in depth.
  const { error } = await ctx.supabase
    .from("join_requests")
    .update({
      status: "rejected",
      rejection_reason: reason?.trim() || null,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      // Drop the now-deleted image URLs so the decided list shows "No photo
      // provided" instead of broken thumbnails (the text details still survive).
      photo_url: null,
      payment_proof_url: null,
    })
    .eq("id", requestId)
    .eq("gym_id", ctx.gymId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  // No member is created for a rejected request, so neither image is needed.
  await removeJoinUploads(ctx.gymId, requestId, ["photo", "proof"]);

  revalidatePath("/join-requests");
  revalidatePath("/dashboard");
  return { ok: true };
}
