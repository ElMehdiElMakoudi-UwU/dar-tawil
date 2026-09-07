/** Health check for Coolify. Deliberately outside the locale redirect. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
