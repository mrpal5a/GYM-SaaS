import { loadJoiningFormData } from "@/lib/members/joining-form-data";
import { renderJoiningFormPdf } from "@/lib/members/joining-form-pdf";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "member";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await loadJoiningFormData(id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await renderJoiningFormPdf(data);
  const filename = `${slugify(data.member.fullName)}-joining-form.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
