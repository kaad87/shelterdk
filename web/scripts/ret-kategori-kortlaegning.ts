/**
 * Retter kortlaegningsraekker, hvor feedets egen kategori navngiver ét emne,
 * men kortlaegningen peger paa et andet.
 *
 * Koeres:
 *   npx tsx scripts/ret-kategori-kortlaegning.ts --tjek    # viser kun
 *   npx tsx scripts/ret-kategori-kortlaegning.ts           # skriver
 *
 * Maalt 26. oktober 2026 var 60 af de 337 entries i udgivne guider kortlagt
 * til en anden kategori end deres navn siger. Aarsagen er, at kortlaegningen
 * er noeglet paa (retailer, category_raw) og derfor giver ét svar for en hel
 * raa kategori. Backpackerlife skriver den som en liste, og nogen har valgt en
 * af de brede grene:
 *
 *   "Koekkenudstyr & mad > Mad > Udstyr"                 -> kogeudstyr
 *   "Oekser & save > Survival og bushcraft > Udstyr"     -> kniv
 *   "Myggenet & insektbeskyttelse > Soveudstyr"          -> soveudstyr
 *   "Diverse beklaedning > Handsker > Toej og fodtoej"   -> beklaedning
 *   "Gaveideer > Udstyr > Udstyr som gave > Vandrestave" -> gave
 *
 * I alle fem staar det praecise emne som ét af segmenterne. Reglerne herunder
 * matcher derfor paa SEGMENTET og ikke paa hele strengen, saa de ogsaa rammer
 * de ti varianter af den samme gren, som feedet producerer.
 *
 * KUN raekker hvis nuvaerende kategori staar i `fra` roeres. En raekke, nogen
 * har kortlagt praecist, kan derfor ikke blive overskrevet af en bred regel.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

interface Regel {
  /** Segmentet i category_raw, sammenlignet uden hensyn til store bogstaver. */
  segment: string;
  /** Kategorien raekken skal have. */
  til: string;
  /** Kun naar den nuvaerende kategori er én af disse. Tom = ogsaa naar den er null. */
  fra: (string | null)[];
  /** Spring raekken over, hvis den OGSAA navngiver ét af disse segmenter. */
  undtagen?: string[];
  /** Hvad indholdet viste, da reglen blev skrevet. */
  belaeg: string;
}

const REGLER: Regel[] = [
  {
    segment: "Mad",
    til: "mad",
    fra: ["kogeudstyr", null],
    belaeg: "75 varer, alle frysetoerret mad: Tactical Foodpack, Trek'N Eat, Adventure Food",
  },
  {
    segment: "Økser & save",
    til: "oekse",
    fra: ["kniv", "prepping", null],
    belaeg: "8 varer: fire save og fire oekser. Guiden heder 'Bedste oekser og save'",
  },
  {
    segment: "Myggenet & insektbeskyttelse",
    til: "myggenet",
    fra: ["soveudstyr", "hygiejne", "beklædning", null],
    belaeg: "myggenet til hoved og telt, bug jackets",
  },
  {
    segment: "Myggenet",
    til: "myggenet",
    fra: ["hygiejne", null],
    belaeg: "outmore::Myggenet, 53 varer: head nets, bug jackets, pyramidenet",
  },
  {
    segment: "Handsker",
    til: "handsker",
    fra: ["beklædning", null],
    belaeg: "handsker og luffer fra Black Diamond, OMM, Highlander, Trespass",
  },
  {
    segment: "Huer, hatte og diverse",
    til: "hue",
    fra: ["beklædning", null],
    belaeg: "14 varer: huer, beanies, boellehatte, kasketter",
  },
  {
    segment: "Hovedbeklædning",
    til: "hue",
    fra: ["beklædning", null],
    belaeg: "samme gren, kortere variant",
  },
  {
    segment: "Halsedisse",
    til: "hue",
    fra: [null],
    belaeg: "outmore::Halsedisse, BUFF merino-halsroer. Navnet siger ikke altid hvad det er",
  },
  {
    segment: "Vandrestave",
    til: "vandrestav",
    fra: ["gave", "tilbehoer", null],
    belaeg: "Black Diamond, Treklife og Highlander vandrestave, kortlagt som 'gave'",
  },
  {
    segment: "Lanterner",
    til: "lygte",
    fra: ["pandelampe", null],
    belaeg: "16 varer: stormlanterner, lanterner og vaeger. Ikke pandelamper",
  },
  {
    segment: "Siddeunderlag",
    til: "siddeunderlag",
    fra: ["soveudstyr", "liggeunderlag", null],
    // Én raekke navngiver baade Siddeunderlag og "Puder & nakkepuder", og den
    // rummer et taeppe. Den hoerer ikke under siddeunderlag.
    undtagen: ["Puder & nakkepuder"],
    belaeg: "siddeunderlag og siddepuder",
  },
  {
    segment: "Pude",
    til: "soveudstyr",
    fra: ["campingmobler", null],
    belaeg: "outmore::Pude, 55 varer: Sea to Summit Aeros, Nemo Fillo, Big Agnes Rapide",
  },
  {
    segment: "Kompasser",
    til: "navigation",
    fra: ["prepping", "foerstehjaelp", null],
    belaeg: "Silva, Highlander og SOL kompasser, kortlagt som 'prepping'",
  },
];

/** Segmenterne i en raa kategori. Backpackerlife skiller dem med ">". */
function segmenter(raa: string): string[] {
  return raa.split(">").map((s) => s.trim().toLowerCase());
}

async function hentKortlaegning(klient: SupabaseClient) {
  const ud: { retailer: string; category_raw: string; category_mapped: string | null }[] = [];
  for (let fra = 0; ; fra += 1000) {
    const { data, error } = await klient
      .from("affiliate_category_mapping")
      .select("retailer, category_raw, category_mapped")
      .order("retailer")
      .order("category_raw")
      .range(fra, fra + 999);
    if (error) throw new Error(`affiliate_category_mapping: ${error.message}`);
    if (!data?.length) break;
    ud.push(...data);
    if (data.length < 1000) break;
  }
  return ud;
}

async function main() {
  const kunTjek = process.argv.includes("--tjek");
  const raekker = await hentKortlaegning(sb);

  const aendringer: {
    retailer: string;
    category_raw: string;
    fra: string | null;
    til: string;
    regel: string;
  }[] = [];

  for (const r of raekker) {
    const segs = segmenter(r.category_raw);
    for (const regel of REGLER) {
      if (!segs.includes(regel.segment.toLowerCase())) continue;
      if (regel.undtagen?.some((u) => segs.includes(u.toLowerCase()))) continue;
      if (!regel.fra.includes(r.category_mapped)) continue;
      if (r.category_mapped === regel.til) continue;
      aendringer.push({
        retailer: r.retailer,
        category_raw: r.category_raw,
        fra: r.category_mapped,
        til: regel.til,
        regel: regel.segment,
      });
      break; // foerste regel der passer vinder
    }
  }

  const prRegel = new Map<string, number>();
  for (const a of aendringer) prRegel.set(a.regel, (prRegel.get(a.regel) ?? 0) + 1);

  console.log(`kortlaegningsraekker: ${raekker.length}`);
  console.log(`raekker der rettes:   ${aendringer.length}\n`);
  for (const [regel, n] of [...prRegel].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  segment "${regel}"`);
    for (const a of aendringer.filter((x) => x.regel === regel).slice(0, 3)) {
      console.log(`         ${a.fra} -> ${a.til}  |  ${a.retailer}::${a.category_raw.slice(0, 78)}`);
    }
  }

  if (kunTjek) {
    console.log("\n--tjek: intet skrevet");
    return;
  }

  let skrevet = 0;
  for (const a of aendringer) {
    const { error } = await sb
      .from("affiliate_category_mapping")
      .update({ category_mapped: a.til })
      .eq("retailer", a.retailer)
      .eq("category_raw", a.category_raw);
    if (error) {
      console.error(`${a.retailer}::${a.category_raw}: ${error.message}`);
      process.exit(1);
    }
    skrevet++;
  }
  console.log(`\nrettet: ${skrevet} kortlaegningsraekker`);
  console.log("Koer derefter afstem-kategorier.ts, saa varerne foelger med.");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
