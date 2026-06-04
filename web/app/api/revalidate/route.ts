import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

/**
 * POST /api/revalidate
 *
 * On-demand revalidering af ISR-cachede sider. Netlifys durable cache rydes
 * IKKE af et almindeligt deploy, så efter fx en data-opdatering (nye shelters,
 * billed-berigelse) skal de berørte stier revalideres eksplicit — ellers
 * serveres den gamle render indtil revalidate-vinduet (24t).
 *
 * Body: { paths: string[] }  eller  { path: string }
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body.paths)
    ? body.paths.filter((p: unknown): p is string => typeof p === "string")
    : typeof body.path === "string"
      ? [body.path]
      : [];

  if (paths.length === 0) {
    return NextResponse.json({ error: "paths er påkrævet" }, { status: 400 });
  }

  const revalidated: string[] = [];
  for (const p of paths) {
    try {
      revalidatePath(p);
      revalidated.push(p);
    } catch {
      // ignorér enkelte fejl, fortsæt resten
    }
  }

  return NextResponse.json({ ok: true, revalidated });
}
