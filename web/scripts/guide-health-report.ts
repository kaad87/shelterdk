/**
 * Dagligt sundhedstjek af købsguiderne, til guide-health-monitor.yml.
 *
 * Kører via:
 *   npm run guide-health              # menneskelig rapport, exit 0
 *   npm run guide-health -- --json    # maskinlæsbart, til vagtjobbet
 *
 * Henter sin vurdering fra lib/guide-health.ts, så der kun findes én
 * definition af hvad en usund guide er — den samme som admin-endpointet og
 * dens tests bruger. Scriptet laver kun forespørgslen.
 *
 * Bruger de Supabase-secrets, der allerede ligger i repoet til produkt-synken,
 * frem for at kalde admin-endpointet. Det ville kræve en ny ADMIN_SECRET i
 * GitHub, og et vagtjob er ikke værd at lægge en ekstra hemmelighed ud for.
 */
import { createClient } from "@supabase/supabase-js";
import { guideHealth, type GuideHealth, type HealthEntry } from "../lib/guide-health";

// Samme mønster som sync-affiliate-products.ts: i GitHub kommer nøglerne fra
// workflowets env, lokalt fra .env.local.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv ikke tilgængelig — produktions-env antages */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/**
 * Henter alle rækker, 1.000 ad gangen, og dør hvis en forespørgsel fejler.
 *
 * Fejlen blev tidligere kasseret: `const { data } = await …` smed error væk,
 * og en fejlet side gav `data = null`, som løkken læste som "ikke flere
 * rækker". Resultatet var en tavs, afkortet rapport — fejler siden med
 * guide-entries, ser alle guider tomme ud, og vagtjobbet mailer at hele sitet
 * er brudt. En rapport man ikke kan stole på er værre end ingen rapport, så
 * den kaster i stedet og lader jobbet fejle synligt.
 */
async function alle<T>(
  hvad: string,
  hent: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
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

/**
 * Maerkenavne med mindst tre varer i kataloget.
 *
 * Bruges til at skelne et produktnavn i fed skrift fra et begreb i fed skrift.
 * Taersklen paa tre holder stavefejl og engangsvaerdier ude af vokabularet.
 */
async function hentMaerker(klient: typeof sb): Promise<string[]> {
  const raekker = await alle<{ brand: string | null }>("maerker", (fra, til) =>
    klient.from("affiliate_products").select("brand").order("id").range(fra, til),
  );
  const antal = new Map<string, number>();
  for (const r of raekker) {
    const b = (r.brand ?? "").trim();
    if (b.length < 4 || /^\d/.test(b)) continue;
    antal.set(b, (antal.get(b) ?? 0) + 1);
  }
  return [...antal].filter(([, n]) => n >= 3).map(([b]) => b);
}

async function main() {
  const somJson = process.argv.includes("--json");

  const guides = await alle<{
    id: string; slug: string; last_reviewed_at: string | null;
    seo_title: string | null; seo_description: string | null;
  }>(
    "buying_guides",
    (f, t) => sb.from("buying_guides")
      .select("id, slug, last_reviewed_at, seo_title, seo_description, body_md")
      .eq("status", "published").range(f, t)
  );
  const entries = await alle<{ guide_id: string; award_label: string | null; affiliate_product_id: string }>(
    "buying_guide_entries",
    (f, t) => sb.from("buying_guide_entries")
      .select("guide_id, award_label, affiliate_product_id").range(f, t)
  );

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id).filter(Boolean))];
  const produkter = new Map<string, {
    in_stock: boolean | null; is_blocked: boolean | null;
    last_seen_at: string | null; retailer: string | null;
  }>();
  // Samme grund som ovenfor: et fejlet opslag efterlod produkterne ude af
  // kortet, og de faldt derefter tilbage på inStock:false/isBlocked:true —
  // altså blev sunde varer meldt døde.
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from("affiliate_products")
      .select("id, in_stock, is_blocked, last_seen_at, retailer, product_name, brand")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`affiliate_products: ${error.message}`);
    for (const p of data ?? []) produkter.set(p.id, p);
  }

  // Maerkevokabular fra hele kataloget. Én kolonne, men alle raekker, saa den
  // hentes én gang pr. koersel. Mindst tre varer pr. maerke, saa en enkelt
  // stavefejl i et feed ikke bliver et "maerke".
  const maerker = await hentMaerker(sb);

  const nu = new Date();
  const pr = new Map<string, HealthEntry[]>();
  const navne = new Map<string, string[]>();
  for (const e of entries) {
    const p = produkter.get(e.affiliate_product_id);
    const nl = navne.get(e.guide_id) ?? [];
    nl.push(`${p?.product_name ?? ""} ${p?.brand ?? ""}`);
    navne.set(e.guide_id, nl);
    const liste = pr.get(e.guide_id) ?? [];
    liste.push({
      inStock: p?.in_stock ?? false,
      isBlocked: p?.is_blocked ?? true,
      lastSeenAt: p?.last_seen_at ?? null,
      awardLabel: e.award_label,
      retailer: p?.retailer ?? null,
    });
    pr.set(e.guide_id, liste);
  }

  const health: GuideHealth[] = guides
    .map((g) => guideHealth(
      { slug: g.slug, lastReviewedAt: g.last_reviewed_at, entries: pr.get(g.id) ?? [],
        seoTitle: g.seo_title, seoDescription: g.seo_description,
        bodyMd: g.body_md, entryNames: navne.get(g.id) ?? [],
        knownBrands: maerker }, nu))
    .sort((a, b) => b.problems.length - a.problems.length || b.dead - a.dead);

  if (somJson) {
    console.log(JSON.stringify({ health }));
    return;
  }

  const syge = health.filter((h) => h.problems.length > 0);
  console.log(`${health.length} købsguider · ${syge.length} med problemer\n`);
  for (const h of health) {
    const forh = h.topRetailer
      ? `  ·  ${h.topRetailer} ${Math.round(h.topRetailerShare * 100)}%` : "";
    const risk = h.concentrationRisk ? "  [koncentration]" : "";
    console.log(`  ${h.slug}: ${h.total - h.dead}/${h.total} købbare${forh}${risk}`);
    for (const p of h.problems) console.log(`      - ${p}`);
  }
  const udsatte = health.filter((h) => h.survivesTopRetailerLoss === 0 && h.total - h.dead > 0);
  console.log(`\nKoncentration (alarmerer ikke): ` +
    `${health.filter((h) => h.concentrationRisk).length} over 60%, ` +
    `${udsatte.length} ville dø helt hvis største forhandler forsvandt`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
