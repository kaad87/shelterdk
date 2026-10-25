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

/**
 * GET — sundhedsstatus pr. guide, så døde produktpladser er synlige ét sted.
 *
 * Kaldes også af guide-health-monitor.yml hver morgen. Vagtjobbet henter sin
 * vurdering her frem for at gentage forespørgslen, så der kun findes én
 * definition af hvad en usund guide er — og så en fejl i dette endpoint selv
 * bliver opdaget dagligt.
 */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: guides }, { data: entries }] = await Promise.all([
    sb.from("buying_guides").select("id, slug, last_reviewed_at, seo_title, seo_description, body_md"),
    sb.from("buying_guide_entries").select("guide_id, award_label, affiliate_product_id"),
  ]);
  if (!guides || !entries) return NextResponse.json({ error: "db" }, { status: 500 });

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id))];
  const { data: products } = await sb
    .from("affiliate_products")
    .select("id, in_stock, is_blocked, last_seen_at, retailer, product_name, brand")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  // Maerkevokabular fra hele kataloget, ikke kun fra guidernes egne varer: det
  // tilfaelde tjekket findes for er et maerke, der er helt ude af guiderne,
  // men stadig anbefales i prosaen. Én kolonne, sidet igennem.
  const maerkeAntal = new Map<string, number>();
  for (let fra = 0; ; fra += 1000) {
    const { data } = await sb
      .from("affiliate_products")
      .select("brand")
      .order("id")
      .range(fra, fra + 999);
    if (!data?.length) break;
    for (const r of data) {
      const b = (r.brand ?? "").trim();
      if (b.length < 4 || /^\d/.test(b)) continue;
      maerkeAntal.set(b, (maerkeAntal.get(b) ?? 0) + 1);
    }
    if (data.length < 1000) break;
  }
  const maerker = [...maerkeAntal].filter(([, n]) => n >= 3).map(([b]) => b);

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
            retailer: p?.retailer ?? null,
          };
        });
      const navne = entries
        .filter((e) => e.guide_id === g.id)
        .map((e) => {
          const p = byId.get(e.affiliate_product_id);
          return `${p?.product_name ?? ""} ${p?.brand ?? ""}`;
        });
      return guideHealth({ slug: g.slug, lastReviewedAt: g.last_reviewed_at, entries: rows,
        seoTitle: g.seo_title, seoDescription: g.seo_description,
        bodyMd: g.body_md, entryNames: navne, knownBrands: maerker }, now);
    })
    .sort((a, b) => b.problems.length - a.problems.length || b.dead - a.dead);

  return NextResponse.json({ health });
}
