import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { guideHealth, type HealthEntry } from "@/lib/guide-health";

export const dynamic = "force-dynamic";

function admin(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** GET — sundhedsstatus pr. guide, så døde produktpladser er synlige ét sted. */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: guides }, { data: entries }] = await Promise.all([
    sb.from("buying_guides").select("id, slug, last_reviewed_at"),
    sb.from("buying_guide_entries").select("guide_id, award_label, affiliate_product_id"),
  ]);
  if (!guides || !entries) return NextResponse.json({ error: "db" }, { status: 500 });

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id))];
  const { data: products } = await sb
    .from("affiliate_products")
    .select("id, in_stock, is_blocked, last_seen_at")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const now = new Date();
  const health = guides
    .map((g) => {
      const rows: HealthEntry[] = entries
        .filter((e) => e.guide_id === g.id)
        .map((e) => {
          const p = byId.get(e.affiliate_product_id);
          return {
            inStock: p?.in_stock ?? false,
            isBlocked: p?.is_blocked ?? true,
            lastSeenAt: p?.last_seen_at ?? null,
            awardLabel: e.award_label,
          };
        });
      return guideHealth({ slug: g.slug, lastReviewedAt: g.last_reviewed_at, entries: rows }, now);
    })
    .sort((a, b) => b.problems.length - a.problems.length || b.dead - a.dead);

  return NextResponse.json({ health });
}
