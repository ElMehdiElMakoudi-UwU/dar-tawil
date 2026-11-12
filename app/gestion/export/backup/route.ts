import { fullBackup } from "@/lib/gestion/export";

/**
 * GET /gestion/export/backup — the whole database as JSON, password hashes
 * included so a restore can sign in again. Admins only (checked in fullBackup).
 */
export async function GET() {
  const backup = await fullBackup();
  const stamp = backup.created_at.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dar-tawil-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
