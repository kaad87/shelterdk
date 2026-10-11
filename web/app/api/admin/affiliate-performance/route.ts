import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  dagligSerie, glidende, grupper, guideSlug, noegletal, topProdukter,
  varmekort, prisfordeling,
  type KlikRaekke, type EventRaekke,
} from "@/lib/affiliate-performance";
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
 * Henter alle rækker, 1.000 ad gangen, og kaster hvis en side fejler.
 *
 * Supabase returnerer højst 1.000 rækker pr. forespørgsel. Uden paginering
 * ville dashboardet tavst vise de første 1.000 klik og kalde det totalen —
 * og en fejlet side ville se ud som "ikke flere data". Begge er værre end
 * en fejlmeddelelse, fordi tallene stadig ser plausible ud.
 */
async function alle<T>(
  hvad: string,
  hent: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const ud: T[] = [];
  for (let fra = 0; ; fra += 1000) {
    const { data, error } = await hent(fra, fra + 999);
    if (error) throw new Error(`${hvad}: ${error.message}`);
    if (!data?.length) break;
    ud.push(...data);
    if (data.length < 1000) break;
  }
  return ud;
}

/** Guide-sundhed, så dashboardet kan vise hvor mange pladser der er døde. */
async function sundhed(sb: SupabaseClient, nu: Date) {
  const guides = await alle<{
    id: string; slug: string; last_reviewed_at: string | null;
    seo_title: string | null; seo_description: string | null;
  }>("buying_guides", (f, t) => sb.from("buying_guides")
    .select("id, slug, last_reviewed_at, seo_title, seo_description")
    .eq("status", "published").range(f, t));
  const entries = await alle<{
    guide_id: string; award_label: string | null; affiliate_product_id: string;
  }>("buying_guide_entries", (f, t) => sb.from("buying_guide_entries")
    .select("guide_id, award_label, affiliate_product_id").range(f, t));

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id).filter(Boolean))];
  const prod = new Map<string, {
    in_stock: boolean | null; is_blocked: boolean | null;
    last_seen_at: string | null; retailer: string | null;
  }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from("affiliate_products")
      .select("id, in_stock, is_blocked, last_seen_at, retailer")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`affiliate_products: ${error.message}`);
    for (const p of data ?? []) prod.set(p.id, p);
  }

  const pr = new Map<string, HealthEntry[]>();
  for (const e of entries) {
    const p = prod.get(e.affiliate_product_id);
    const liste = pr.get(e.guide_id) ?? [];
    liste.push({
      inStock: p?.in_stock ?? false, isBlocked: p?.is_blocked ?? true,
      lastSeenAt: p?.last_seen_at ?? null, awardLabel: e.award_label,
      retailer: p?.retailer ?? null,
    });
    pr.set(e.guide_id, liste);
  }
  const health = guides.map((g) => guideHealth({
    slug: g.slug, lastReviewedAt: g.last_reviewed_at, entries: pr.get(g.id) ?? [],
    seoTitle: g.seo_title, seoDescription: g.seo_description,
  }, nu));
  return {
    guider: health.length,
    medProblemer: health.filter((h) => h.problems.length > 0).length,
    pladser: health.reduce((s, h) => s + h.total, 0),
    doedePladser: health.reduce((s, h) => s + h.dead, 0),
    problemer: health.filter((h) => h.problems.length > 0)
      .map((h) => ({ slug: h.slug, problems: h.problems })),
    koncentration: health.filter((h) => h.concentrationRisk).length,
    enForhandler: health.filter((h) => h.singleRetailerRisk).length,
  };
}

/**
 * GET — alt dashboardet skal vise, aggregeret ét sted.
 *
 * Aggregeringen sker på serveren og ikke i browseren, så en graf og tabellen
 * ved siden af ikke kan regne forskelligt, og så klienten ikke skal hente
 * tusinder af rækker for at tælle dem.
 *
 *   ?dage=90   vinduet for grafer (7-365, standard 90)
 *   ?periode=28 vinduet for nøgletal og retningspile (7-90, standard 28)
 */
export async function GET(req: NextRequest) {
  const sb = admin(req);
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const dage = Math.min(365, Math.max(7, Number(sp.get("dage")) || 90));
  const periode = Math.min(90, Math.max(7, Number(sp.get("periode")) || 28));
  const nu = new Date();
  // Hent hele grafvinduet, men mindst to perioder, så retningspilene har
  // noget at sammenligne med selv når grafvinduet er kort.
  const hentDage = Math.max(dage, periode * 2) + 1;
  const fra = new Date(nu.getTime() - hentDage * 86_400_000).toISOString();

  try {
    // Alle fire uafhængige hentninger samtidig. Sundhedsopslaget lå
    // tidligere efter de to andre og lagde sin egen rundtur oven i
    // svartiden, selv om det ikke afhænger af dem.
    const [klik, events, sund, katalogIalt, koebbare] = await Promise.all([
      alle<KlikRaekke>("affiliate_clicks", (f, t) => sb.from("affiliate_clicks")
        .select("created_at, path, placement, retailer, category, price_dkk, product_name, brand")
        .gte("created_at", fra).order("created_at").range(f, t)),
      alle<EventRaekke>("internal_events", (f, t) => sb.from("internal_events")
        .select("created_at, event, path, params")
        .gte("created_at", fra).order("created_at").range(f, t)),
      sundhed(sb, nu),
      sb.from("affiliate_products").select("id", { count: "exact", head: true })
        .then((r) => r.count),
      sb.from("affiliate_products").select("id", { count: "exact", head: true })
        .eq("in_stock", true).eq("is_blocked", false).then((r) => r.count),
    ]);

    const serie = dagligSerie(klik, events, nu, dage);
    const datoer = serie.map((d) => d.dato);

    // Forhandler-mix over tid: kun de fem største får egen flade, resten
    // samles. Flere end det giver farver man ikke kan skelne.
    const forhandlere = grupper(klik, (k) => k.retailer, nu, dage);
    const top5 = forhandlere.slice(0, 5);
    const resten = forhandlere.slice(5);
    const mix = [
      ...top5.map((b) => ({ navn: b.navn, vaerdier: b.serie })),
      ...(resten.length
        ? [{
            navn: `øvrige (${resten.length})`,
            vaerdier: datoer.map((_, i) => resten.reduce((s, b) => s + b.serie[i], 0)),
          }]
        : []),
    ];

    return NextResponse.json({
      genereret: nu.toISOString(),
      vindue: { dage, periode, fra: datoer[0] ?? null, til: datoer[datoer.length - 1] ?? null },
      noegletal: noegletal(klik, events, nu, periode),
      serie,
      glidende: {
        klik: glidende(serie.map((d) => d.klik), 7),
        vaerdi: glidende(serie.map((d) => d.vaerdi), 7),
        grejVisninger: glidende(serie.map((d) => d.grejVisninger), 7),
      },
      guider: grupper(klik, (k) => guideSlug(k.path), nu, dage),
      forhandlere,
      forhandlerMix: { datoer, serier: mix },
      placeringer: grupper(klik, (k) => k.placement, nu, dage),
      kategorier: grupper(klik, (k) => k.category, nu, dage),
      stier: grupper(klik, (k) => (k.path ?? "").split("?")[0] || null, nu, dage),
      produkter: topProdukter(klik, 25),
      varmekort: varmekort(klik),
      prisfordeling: prisfordeling(klik),
      sundhed: sund,
      katalog: { ialt: katalogIalt ?? null, koebbare: koebbare ?? null },
      // Datagrundlagets grænser hører med i svaret: internal_events blev først
      // slået til 3. oktober 2026, så en grejblok-graf over 90 dage er tom i
      // det meste af vinduet. Uden denne linje ser det ud som et fald.
      daekning: {
        foersteKlik: klik[0]?.created_at ?? null,
        foersteEvent: events[0]?.created_at ?? null,
        klikRaekker: klik.length,
        eventRaekker: events.length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ukendt fejl" }, { status: 500 });
  }
}
