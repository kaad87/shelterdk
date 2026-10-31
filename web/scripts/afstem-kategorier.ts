/**
 * Gоer de gemte kategorier enige med det, synken ville skrive.
 *
 * Koeres:
 *   npx tsx scripts/afstem-kategorier.ts --tjek    # viser kun
 *   npx tsx scripts/afstem-kategorier.ts           # skriver
 *
 * Synken saetter `category_mapped: kat ?? sikkerKategoriFraNavn(navn) ??
 * mapping?.mapped ?? kategoriFraNavn(navn)`.
 * Den koerer én gang i doegnet, saa efter en aendring i kortlaegningstabellen
 * eller i navnereglerne staar de gemte vaerdier og er uenige med koden indtil
 * naeste nat. Det her script lukker hullet med det samme.
 *
 * KUN de tre ufiltrerede feeds behandles. For prooutdoor, outdoornu, zeejuu og
 * outdooricentrum kommer kategorien fra feed-filteret (`kat`), som kun kendes
 * under en import, og den skal ikke gaettes her.
 *
 * Idempotent: koerer man igen uden at have aendret noget, rettes nul raekker.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { kategoriFraNavn, sikkerKategoriFraNavn } from "../lib/kategori-fra-navn";

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

/** Feeds hvor kategorien kommer fra kortlaegningen og navnet, ikke fra filteret. */
const UFILTREREDE = new Set(["outmore", "backpackerlife", "outdoortid"]);

/**
 * `.order()` er paakraevet sammen med `.range()`: uden en sortering er
 * raekkefoelgen udefineret mellem forespoergsler, og sider bliver sprunget
 * over. Det kostede fem raekker i en tidligere optaelling.
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
  retailer: string;
  category_raw: string | null;
  category_mapped: string | null;
}

async function main() {
  const kunTjek = process.argv.includes("--tjek");

  const kortlaegning = await alle<{ retailer: string; category_raw: string; category_mapped: string | null }>(
    "affiliate_category_mapping",
    (f, t) =>
      sb
        .from("affiliate_category_mapping")
        .select("retailer, category_raw, category_mapped")
        .order("retailer")
        .order("category_raw")
        .range(f, t)
  );
  const kort = new Map(kortlaegning.map((r) => [`${r.retailer}::${r.category_raw}`, r.category_mapped]));

  const varer = await alle<Vare>("affiliate_products", (f, t) =>
    sb
      .from("affiliate_products")
      .select("id, product_name, retailer, category_raw, category_mapped")
      .in("retailer", [...UFILTREREDE])
      .order("id")
      .range(f, t)
  );

  const prNy = new Map<string | null, string[]>();
  const skift = new Map<string, number>();
  for (const v of varer) {
    const fraKort = v.category_raw ? kort.get(`${v.retailer}::${v.category_raw}`) ?? null : null;
    // Samme raekkefoelge som synken, inklusive det sikre navnelag foran
    // kortlaegningen. Staar de to uenige, flytter dette script varer tilbage
    // hver gang det koerer.
    const oensket =
      sikkerKategoriFraNavn(v.product_name) ?? fraKort ?? kategoriFraNavn(v.product_name) ?? null;
    if (oensket === v.category_mapped) continue;
    const l = prNy.get(oensket) ?? [];
    l.push(v.id);
    prNy.set(oensket, l);
    skift.set(`${v.category_mapped ?? "null"} -> ${oensket ?? "null"}`, (skift.get(`${v.category_mapped ?? "null"} -> ${oensket ?? "null"}`) ?? 0) + 1);
  }

  const antal = [...prNy.values()].reduce((s, l) => s + l.length, 0);
  console.log(`varer i de ufiltrerede feeds: ${varer.length}`);
  console.log(`varer der ikke stemmer:       ${antal}\n`);
  for (const [s, n] of [...skift].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(n).padStart(4)}  ${s}`);
  }

  if (kunTjek) {
    console.log("\n--tjek: intet skrevet");
    return;
  }

  let skrevet = 0;
  for (const [kategori, ids] of prNy) {
    for (let i = 0; i < ids.length; i += 200) {
      const del = ids.slice(i, i + 200);
      const { error } = await sb
        .from("affiliate_products")
        .update({ category_mapped: kategori })
        .in("id", del);
      if (error) {
        console.error(`${kategori}: ${error.message}`);
        process.exit(1);
      }
      skrevet += del.length;
    }
  }
  console.log(`\nopdateret: ${skrevet} raekker`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
