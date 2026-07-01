import { getAdminContext } from "@/lib/auth/admin-context";
import { buildGymWorkbook } from "@/lib/admin/export-workbook";
import { loadGymExportData } from "@/lib/admin/gym-export";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) return new Response("Forbidden", { status: 403 });

  const data = await loadGymExportData(ctx.supabase, id);
  if (!data) return new Response("Not found", { status: 404 });

  const wb = buildGymWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${data.gym.slug}-export-${today}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
