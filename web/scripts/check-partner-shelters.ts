/**
 * Verificerer at de hårdkodede Sølund Huse-produkter i lib/partner-shelters.ts
 * stadig findes, og at priserne matcher annoncørens side.
 *
 * Findes fordi købsguiderne endte med 37 døde produktpladser — et manuelt
 * katalog uden tilsyn rådner. Kør den efter prisændringer, eller på cron.
 *
 *   npx tsx scripts/check-partner-shelters.ts
 *
 * Exit 1 hvis et link er dødt eller en pris afviger.
 */
import { PARTNER_SHELTERS, PRICES_CHECKED, partnerAdsLink, isPriceStale } from "../lib/partner-shelters";

const UA = "Mozilla/5.0 (compatible; ShelterDK-linkcheck/1.0)";

/** Sølund skriver priser som "18.999,-" — find alle og se om vores tal er blandt dem. */
function pricesOnPage(html: string): number[] {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const found = new Set<number>();
  for (const m of text.matchAll(/([\d]{1,3}(?:\.\d{3})+)\s*,-/g)) {
    found.add(Number(m[1].replace(/\./g, "")));
  }
  return [...found];
}

async function main() {
  let problems = 0;

  if (isPriceStale(PRICES_CHECKED)) {
    console.warn(`ADVARSEL: PRICES_CHECKED er ${PRICES_CHECKED} — over 60 dage; siden skjuler priserne.`);
  }

  for (const p of PARTNER_SHELTERS) {
    const res = await fetch(p.url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) {
      console.error(`FEJL ${res.status}  ${p.name}  ${p.url}`);
      problems++;
      continue;
    }
    const html = await res.text();
    const priser = pricesOnPage(html);
    const match = priser.includes(p.priceDkk);
    const status = match ? "OK  " : "PRIS";
    console.log(
      `${status} ${p.name}\n       vores ${p.priceDkk} · på siden ${priser.slice(0, 6).join(", ") || "ingen fundet"}`
    );
    if (!match) problems++;

    // Deep linket skal stadig lande på produktet.
    const click = await fetch(partnerAdsLink(p.url), { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!click.ok || !click.url.includes(new URL(p.url).pathname)) {
      console.error(`       affiliate-link fejler: ${click.status} → ${click.url}`);
      problems++;
    }
  }

  console.log(`\n${problems === 0 ? "Alt OK" : `${problems} problem(er)`} — ${PARTNER_SHELTERS.length} produkter tjekket.`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
