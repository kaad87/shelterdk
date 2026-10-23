/**
 * Viser hvad et filtreret feed VILLE gemme, uden at skrive til databasen.
 *
 * Findes fordi udvalget ikke kan bedoemmes paa et tal. Hver gang tallene blev
 * laest i stedet for varerne, slap noget forkert igennem: et landkort i
 * vestkategorien, en halvfingerhandske som solhat, ti ens dunjakker fordi
 * farvefoldningen ikke kendte Outdoornus navneformat. Rapporten er den
 * billigste maade at se den slags, og den er ogsaa raamaterialet naar en guide
 * skal skrives ud fra rigtige beskrivelser.
 *
 * Brug:
 *   npx tsx scripts/feed-udvalg-rapport.ts prooutdoor            # fra cache
 *   npx tsx scripts/feed-udvalg-rapport.ts prooutdoor --hent     # hent live
 *   npx tsx scripts/feed-udvalg-rapport.ts prooutdoor --json ud.json
 *
 * Uden --hent laeses den gzip'ede kopi i data/raw/feeds, som scripts/feed_hent.py
 * lagde. Det sparer 50 MB download pr. kørsel.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { parseFeedXml, type Retailer, type NormalizedProduct } from "../lib/parseAffiliateFeed";
import { feedFor, feedUrl } from "../lib/affiliate-feeds";
import { kategoriFor, prisOk } from "../lib/feed-kategori-filter";
import { vaelgUdvalg, basisNavn } from "../lib/feed-udvalg";

const CACHE = join(__dirname, "..", "..", "data", "raw", "feeds");

/** Nyeste cachede kopi af et feed. */
function fraCache(retailer: string): Buffer {
  const navne = readdirSync(CACHE)
    .filter((n) => n.startsWith(`${retailer}_`) && n.endsWith(".xml.gz"))
    .sort();
  const nyeste = navne[navne.length - 1];
  if (!nyeste) {
    throw new Error(
      `Ingen cachet kopi af ${retailer} i ${CACHE}. Hent den med --hent, eller koer scripts/feed_hent.py.`
    );
  }
  console.log(`laeser ${nyeste}`);
  return gunzipSync(readFileSync(join(CACHE, nyeste)));
}

async function main() {
  const args = process.argv.slice(2);
  const retailer = args.find((a) => !a.startsWith("-"));
  if (!retailer) {
    console.error("Angiv en forhandler, fx: npx tsx scripts/feed-udvalg-rapport.ts prooutdoor");
    process.exit(1);
  }
  const feed = feedFor(retailer);
  if (!feed) throw new Error(`Ukendt forhandler: ${retailer}`);
  if (feed.loftPrKategori == null) {
    throw new Error(`${retailer} importeres helt og har intet udvalg at vise.`);
  }

  const buffer = args.includes("--hent")
    ? Buffer.from(
        await (
          await fetch(feedUrl(feed), {
            headers: { "User-Agent": "ShelterDK/1.0 (+https://shelterdk.dk)" },
          })
        ).arrayBuffer()
      )
    : fraCache(retailer);

  const varer = parseFeedXml(buffer, retailer as Retailer);
  // Samme afvisning af dubletter som synken, saa tallene kan sammenlignes.
  const seen = new Map<string, NormalizedProduct>();
  for (const p of varer) seen.set(p.id, p);

  const katFor = (p: NormalizedProduct) => {
    const k = kategoriFor(p.product_name, p.category_raw);
    return k && prisOk(k, p.price) ? k : null;
  };

  // Tom maengde gemte: rapporten viser udvalget som en foerste import ville
  // laegge det, ikke hvad der allerede staar i basen.
  const { valgte, prKategori } = vaelgUdvalg(
    [...seen.values()],
    katFor,
    new Set(),
    feed.loftPrKategori,
    feed.maksPrBrand
  );

  console.log(`\n${feed.label}: ${varer.length} varer i feedet -> ${valgte.length} gemmes\n`);
  for (const [k, n] of [...prKategori].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${k.padEnd(14)} ${n}`);
  }

  const jsonIdx = args.indexOf("--json");
  if (jsonIdx >= 0 && args[jsonIdx + 1]) {
    const ud = valgte.map((p) => ({
      id: p.id,
      kategori: katFor(p),
      brand: p.brand,
      navn: basisNavn(p.product_name),
      navnIFeedet: p.product_name,
      pris: p.price,
      foer: p.price_original,
      beskrivelse: p.description,
      url: p.affiliate_url,
    }));
    writeFileSync(args[jsonIdx + 1], JSON.stringify(ud, null, 2));
    console.log(`\nskrev ${ud.length} varer til ${args[jsonIdx + 1]}`);
    return;
  }

  for (const kategori of [...prKategori.keys()].sort()) {
    console.log(`\n--- ${kategori}`);
    for (const p of valgte.filter((x) => katFor(x) === kategori)) {
      // Det navn der GEMMES, ikke feedets. Ellers viser rapporten noget
      // andet end importen laegger i basen.
      console.log(`${String(p.price).padStart(9)} kr  ${p.brand ?? "?"} | ${basisNavn(p.product_name)}`);
      console.log(`              ${(p.description ?? "").slice(0, 160)}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
