import { today } from "@/lib/gestion/format";
import { yearWorkbook } from "@/lib/gestion/export";
import { workbook } from "@/lib/gestion/xlsx";

/** GET /gestion/export/xlsx?year=2026 — the year's books as one workbook. Admins only (checked in yearWorkbook). */
export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("year"));
  const year = Number.isInteger(raw) && raw > 2000 && raw < 2100 ? raw : Number(today().slice(0, 4));
  const file = workbook(await yearWorkbook(year));
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dar-tawil-${year}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
