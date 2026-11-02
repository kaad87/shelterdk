/**
 * Maaler forudsaetningerne for /grej/[slug], foer siden bygges.
 *
 *   npx tsx scripts/maal-produktside.ts
 *
 * To spoergsmaal, som begge kan vaelte designet:
 *   1. Giver rentNavn() + produktSlug() unikke URL'er for de 362 varer?
 *   2. Hvor mange af dem findes hos mere end én butik, saa prismodulet har
 *      noget at sammenligne?
 */
import { createClient } from "@supabase/supabase-js";
import { rentNavn, rentMaerke } from "../lib/produktnavn";
import { produktSlug } from "../lib/produkt-slug";
import { matchNoegle, samlTilbud, type MatchVare } from "../lib/produkt-match";

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
  display_name: string | null;
  display_brand: string | null;
  retailer: string;
  category_mapped: string | null;
  price: number;
  affiliate_url: string;
  in_stock: boolean;
  is_blocked: boolean;
}

async function main() {
  const varer = await alle<Vare>("affiliate_products", (f, t) =>
    sb
      .from("affiliate_products")
      .select(
        "id, product_name, brand, display_name, display_brand, retailer, category_mapped, price, affiliate_url, in_stock, is_blocked"
      )
      .order("id")
      .range(f, t)
  );
  const efterId = new Map(varer.map((v) => [v.id, v]));

  const guider = await alle<{ id: string; slug: string }>("buying_guides", (f, t) =>
    sb.from("buying_guides").select("id, slug").eq("status", "published").order("slug").range(f, t)
  );
  const slugEfterGuide = new Map(guider.map((g) => [g.id, g.slug]));
  const entries = await alle<{ guide_id: string; affiliate_product_id: string }>(
    "buying_guide_entries",
    (f, t) =>
      sb.from("buying_guide_entries").select("guide_id, affiliate_product_id").order("guide_id").range(f, t)
  );

  const iGuide = new Map<string, string[]>();
  for (const e of entries) {
    const slug = slugEfterGuide.get(e.guide_id);
    if (!slug) continue;
    const liste = iGuide.get(e.affiliate_product_id) ?? [];
    if (!liste.includes(slug)) liste.push(slug);
    iGuide.set(e.affiliate_product_id, liste);
  }

  const guideVarer = [...iGuide.keys()]
    .map((id) => efterId.get(id))
    .filter((v): v is Vare => Boolean(v));

  // --- 1. Slug-kollisioner -------------------------------------------------
  const efterSlug = new Map<string, Vare[]>();
  for (const v of guideVarer) {
    const s = produktSlug(rentNavn(v));
    const l = efterSlug.get(s) ?? [];
    l.push(v);
    efterSlug.set(s, l);
  }
  const tomme = guideVarer.filter((v) => !produktSlug(rentNavn(v)));
  const kollisioner = [...efterSlug.entries()].filter(([, l]) => l.length > 1);

  console.log(`=== 1. Slugs for ${guideVarer.length} guide-varer ===`);
  console.log(`unikke slugs:   ${efterSlug.size}`);
  console.log(`tomme slugs:    ${tomme.length}`);
  console.log(`kollisioner:    ${kollisioner.length}`);
  for (const [s, l] of kollisioner) {
    console.log(`  /grej/${s}`);
    for (const v of l) console.log(`      ${v.retailer.padEnd(16)} ${v.id}   "${v.product_name}"`);
  }

  // --- 2. Samme model hos flere butikker -----------------------------------
  const koebbare = varer.filter((v) => v.in_stock && !v.is_blocked) as unknown as MatchVare[];
  const alle_match = varer as unknown as MatchVare[];

  const klynger: string[] = [];
  let medMakker = 0;
  for (const v of guideVarer) {
    const mv = v as unknown as MatchVare;
    if (!matchNoegle(mv)) continue;
    const tilbud = samlTilbud(mv, alle_match);
    if (tilbud.length < 2) continue;
    medMakker++;
    const linje = tilbud
      .map((t) => `${t.retailer} ${t.price.toFixed(2)}${t.varianter > 1 ? ` (${t.varianter} str.)` : ""}`)
      .join("  |  ");
    klynger.push(`  ${rentNavn(v).slice(0, 46).padEnd(46)} ${linje}`);
  }

  console.log();
  console.log(`=== 2. Guide-varer med samme model hos en anden butik ===`);
  console.log(`${medMakker} af ${guideVarer.length} (${Math.round((100 * medMakker) / guideVarer.length)}%)`);
  console.log(klynger.join("\n"));
  console.log(`\n(koebbare i kataloget: ${koebbare.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
