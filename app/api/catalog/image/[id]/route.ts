import { sql } from "@/lib/gestion/db";

/**
 * GET /api/catalog/image/<id> — a photo uploaded from /gestion/admin/collections.
 * Uploads are never changed in place (a new photo gets a new id), so the
 * browser and the image optimiser may keep them forever.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/catalog/image/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 });

  const [img] = await sql<{ mime: string; data: Buffer }[]>`
    select mime, data from catalog_images where id = ${id} and data is not null`;
  if (!img) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mime,
      "Content-Length": String(img.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
