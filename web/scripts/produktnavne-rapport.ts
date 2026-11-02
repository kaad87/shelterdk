/**
 * Viser hvad rentNavn() ville kalde varerne, og hvilke der skal have en haand.
 *
 * Koeres:
 *   npx tsx scripts/produktnavne-rapport.ts            # kun guide-varerne
 *   npx tsx scripts/produktnavne-rapport.ts --alle     # hele kataloget
 *   npx tsx scripts/produktnavne-rapport.ts --haand    # kun dem der skal rettes
 *
 * Udledningen i lib/produktnavn.ts skal ikke tros paa, den skal laeses
 * igennem. Det her er vaerktoejet til det. Varerne i udgivne guider kommer
 * foerst, fordi de er dem der staar i llms.txt, i ItemList-skemaet og paa
 * hub-kortene, og dermed dem en forkert udledning gaar galt paa foerst.
 */
import { createClient } from "@supabase/supabase-js";
import { rentNavn, rentMaerke, navnBehoeverHaand } from "../lib/produktnavn";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv ikke tilgaengelig */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/**
 * `.order()` er paakraevet sammen med `.range()`: uden sortering er
 * raekkefoelgen udefineret mellem forespoergsler, og sider springes over.
 */
async function alle<T>(
  hvad: string,
  hent: (fra: number, til: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
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

interface Vare {
  id: string;
  product_name: string;
  brand: string | null;
  retailer: string;
  display_name: string | null;
  display_brand: string | null;
  in_stock: boolean;
  is_blocked: boolean;
}

async function main() {
  const kunHaand = process.argv.includes("--haand");
  const heleKataloget = process.argv.includes("--alle");

  const varer = await alle<Vare>("affiliate_products", (f, t) =>
    sb
      .from("affiliate_products")
      .select("id, product_name, brand, retailer, display_name, display_brand, in_stock, is_blocked")
      .order("id")
      .range(f, t)
  );
  const efterId = new Map(varer.map((v) => [v.id, v]));

  const guider = await alle<{ id: string; slug: string }>("buying_guides", (f, t) =>
    sb.from("buying_guides").select("id, slug").eq("status", "published").order("slug").range(f, t)
  );
  const slugEfterGuide = new Map(guider.map((g) => [g.id, g.slug]));
  const entries = await alle<{ guide_id: string; affiliate_product_id: string; rank: number }>(
    "buying_guide_entries",
    (f, t) =>
      sb
        .from("buying_guide_entries")
        .select("guide_id, affiliate_product_id, rank")
        .order("guide_id")
        .order("rank")
        .range(f, t)
  );

  const iGuide = new Map<string, string[]>();
  for (const e of entries) {
    const slug = slugEfterGuide.get(e.guide_id);
    if (!slug) continue;
    const liste = iGuide.get(e.affiliate_product_id) ?? [];
    liste.push(slug);
    iGuide.set(e.affiliate_product_id, liste);
  }

  const udvalg = heleKataloget
    ? varer.filter((v) => v.in_stock && !v.is_blocked)
    : [...iGuide.keys()].map((id) => efterId.get(id)).filter((v): v is Vare => Boolean(v));

  let aendret = 0;
  let haand = 0;
  const haandListe: Vare[] = [];

  for (const v of udvalg) {
    const nyt = rentNavn(v);
    const maerke = rentMaerke(v);
    const skalHaves = navnBehoeverHaand(v);
    if (skalHaves) {
      haand++;
      haandListe.push(v);
    }
    if (nyt !== v.product_name) aendret++;
    if (kunHaand) continue;
    const guider = iGuide.get(v.id);
    console.log(`${skalHaves ? "HAAND " : "      "}${v.retailer.padEnd(15)}${guider ? `/bedste/${guider.join(",")}` : ""}`);
    console.log(`        foer: ${v.product_name}`);
    console.log(`        nu:   ${nyt}${maerke ? `   [maerke: ${maerke}]` : "   [INTET MAERKE]"}`);
  }

  if (kunHaand) {
    console.log(`=== ${haandListe.length} varer der skal have et display_name i haanden ===`);
    for (const v of haandListe) {
      const guider = iGuide.get(v.id);
      console.log(`  ${v.retailer.padEnd(15)} ${guider ? `/bedste/${guider.join(",")}`.padEnd(30) : "".padEnd(30)} ${v.product_name}`);
      console.log(`  ${"".padEnd(15)} ${"".padEnd(30)} -> udledt: "${rentNavn(v)}"`);
    }
  }

  console.log();
  console.log(`varer set:            ${udvalg.length}`);
  console.log(`navnet bliver aendret: ${aendret} (${Math.round((100 * aendret) / udvalg.length)}%)`);
  console.log(`skal have en haand:   ${haand} (${Math.round((100 * haand) / udvalg.length)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
