/**
 * Skriver display_name paa de varer hvor udledningen kollapser flere
 * produkter til ét navn.
 *
 *   npx tsx scripts/saet-display-navn.ts --vis     # vis hvad der ville ske
 *   npx tsx scripts/saet-display-navn.ts --skriv   # skriv det
 *
 * Baggrund: rentNavn() dropper alt foran maerket, fordi det normalt er
 * feedets typebeskrivelse ("Stol - Treklife Low-back UL Chair"). Naar det
 * SAMME maerke og den samme model saelges som flere varianter, er netop den
 * typebeskrivelse det eneste der skiller dem ad, og saa bliver tre varer til
 * ét navn. Maalt 1. november 2026: 2 klynger, 5 varer, alle backpackerlife.
 *
 * Navnene herunder er ikke fundet paa: typeordet er taget ordret fra feedets
 * eget navn og sat bagerst, saa maerket stadig staar foerst.
 */
import { createClient } from "@supabase/supabase-js";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv ikke tilgaengelig */
}

/** id -> display_name. Null ville betyde "brug udledningen" og staar derfor ikke her. */
const NAVNE: Record<string, string> = {
  // "Regnjakke herre - Treklife Rain Packaway - Sort"
  "backpackerlife-381333": "Treklife Rain Packaway Regnjakke",
  // "Regnbukser herre - Treklife Rain Packaway - Sort"
  "backpackerlife-381367": "Treklife Rain Packaway Regnbukser",
  // "Regnsæt herre - Treklife Rain Packaway - Sort"
  "backpackerlife-394566": "Treklife Rain Packaway Regnsæt",
  // "Uldundertrøje herre - Ulvang Rav - 100% merino uld"
  "backpackerlife-51005": "Ulvang Rav Uldundertrøje",
  // "Uldunderbukser herre - Ulvang Rav - 100 % merino uld"
  "backpackerlife-51539": "Ulvang Rav Uldunderbukser",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const skriv = process.argv.includes("--skriv");
  const ids = Object.keys(NAVNE);

  const { data, error } = await sb
    .from("affiliate_products")
    .select("id, product_name, display_name")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const fundne = new Set((data ?? []).map((v) => v.id));
  for (const id of ids) {
    if (!fundne.has(id)) console.error(`ADVARSEL: ${id} findes ikke i basen, springes over`);
  }

  for (const v of data ?? []) {
    console.log(`${v.id}`);
    console.log(`   feed:  ${v.product_name}`);
    console.log(`   foer:  ${v.display_name ?? "(null, altsaa udledningen)"}`);
    console.log(`   nu:    ${NAVNE[v.id]}`);
  }

  if (!skriv) {
    console.log("\nIntet skrevet. Koer med --skriv for at gemme.");
    return;
  }

  let skrevet = 0;
  for (const v of data ?? []) {
    const { error: e } = await sb
      .from("affiliate_products")
      .update({ display_name: NAVNE[v.id] })
      .eq("id", v.id);
    if (e) throw new Error(`${v.id}: ${e.message}`);
    skrevet++;
  }
  console.log(`\n${skrevet} varer opdateret.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
