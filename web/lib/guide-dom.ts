/**
 * Guidens dom som én citérbar paastand.
 *
 * Findes fordi en sprogmodel loefter hele paastande, og sitets svarkapsel ikke
 * var én. Udtrukket af /bedste/sovepose stod der "Vores valg Sovepose -
 * Snugpak Travelpak 3 8,7/10 599 kr." — produktet, scoren og prisen er der,
 * men hverken afsenderen eller begrundelsen. En paastand uden afsender bliver
 * et anonymt faktum frem for en henvisning, og forskellen er, om sitet bliver
 * brugt eller bliver naevnt.
 *
 * Maalt: AI-assistenter stod for 0,9 % af affiliate-klikkene i juni 2026 og
 * 5,5 % i oktober, altsaa sitets hurtigst voksende kanal.
 *
 * Saetningen GENERERES af praedikat, pris, score og best_for frem for at staa
 * i prosaen. Det er med vilje: /bedste/campingstol havde et haandskrevet
 * afsnit, der anbefalede tre stole, som var fjernet fra siden uden at teksten
 * fulgte med. En genereret saetning kan ikke komme ud af trit.
 */
import type { BuyingGuide, GuideEntryWithProduct } from "@/lib/buying-guides";
import { vaelgVinder } from "@/lib/buying-guides";
import { formatScore } from "@/lib/buying-guides-score";

export interface GuideDom {
  /** "ShelterDKs foerstevalg til campingstol" — uden kolon. */
  overskrift: string;
  /** Produktnavnet som det ogsaa staar paa kortet, saa de kan kobles. */
  produkt: string | null;
  /** "449 kr." */
  pris: string | null;
  /** "8,7 af 10" */
  score: string | null;
  /** best_for, med stort begyndelsesbogstav. */
  begrundelse: string | null;
  /** "Guiden sammenligner 7 produkter fra 149 til 1.199 kr." */
  ramme: string | null;
}

/**
 * Emnet fra guidens titel: "Bedste sovepose til vinter 2026" bliver
 * "sovepose til vinter".
 *
 * Udledt af titlen og ikke af kategorislug'en, fordi slug'en er teknisk
 * ("sovepose-til-vinter") og titlen er det sprog siden selv bruger. Aarstallet
 * fjernes, fordi paastanden skal kunne staa naar aaret skifter.
 */
export function emneFraTitel(titel: string): string {
  let t = titel
    .replace(/^bedste?\s+/i, "")
    .replace(/\s+\d{4}\s*$/, "")
    .trim();
  // Smaa begyndelsesbogstaver, men ikke paa forkortelser som "UL" eller "GPS".
  const foerste = t.split(/\s+/)[0] ?? "";
  if (foerste.length > 1 && foerste === foerste.toUpperCase()) return t;
  t = t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

function kroner(n: number): string {
  return `${n.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr.`;
}

/**
 * Dommen for en guide, eller null naar der ikke er noget at haevde.
 *
 * Returnerer null uden et foerstevalg frem for at gaette: siden udpeger selv
 * intet, og en paastand siden modsiger er vaerre end ingen paastand. Det var
 * praecis fejlen i llms.txt, hvor fire guider navngav en anden vare end deres
 * egen side.
 */
export function guideDom(
  guide: Pick<BuyingGuide, "title">,
  entries: GuideEntryWithProduct[]
): GuideDom | null {
  const koebbare = entries.filter((e) => e.product.in_stock && !e.product.is_blocked);
  if (!koebbare.length) return null;

  const emne = emneFraTitel(guide.title);
  const priser = koebbare
    .map((e) => e.product.price)
    .filter((n): n is number => typeof n === "number");
  const ramme = priser.length
    ? `Guiden sammenligner ${koebbare.length} produkter fra ${kroner(Math.min(...priser))} til ${kroner(Math.max(...priser))}`
    : null;

  const vinder = vaelgVinder(
    entries.map((e) => ({
      ...e,
      tilgaengelig: e.product.in_stock && !e.product.is_blocked,
    }))
  );
  if (!vinder) {
    return { overskrift: `ShelterDK om ${emne}`, produkt: null, pris: null, score: null, begrundelse: null, ramme };
  }

  const b = (vinder.best_for ?? "").trim();
  return {
    overskrift: `ShelterDKs førstevalg til ${emne}`,
    produkt: vinder.product.product_name,
    pris: typeof vinder.product.price === "number" ? kroner(vinder.product.price) : null,
    score: vinder.score != null ? `${formatScore(vinder.score)} af 10` : null,
    begrundelse: b ? b.charAt(0).toUpperCase() + b.slice(1) : null,
    ramme,
  };
}

/**
 * Dommen som én linje ren tekst, til llms.txt og til at kunne sammenligne med
 * hvad siden viser.
 */
export function domSomTekst(dom: GuideDom | null): string | null {
  if (!dom || !dom.produkt) return null;
  const dele = [dom.produkt, dom.pris, dom.score].filter(Boolean).join(", ");
  const halen = [dom.begrundelse, dom.ramme].filter(Boolean).join(". ");
  // Intet punktum oven i et, der allerede er der: kroner() slutter paa "kr."
  const punkt = (t: string) => (t.endsWith(".") ? t : `${t}.`);
  return punkt(`${dom.overskrift}: ${punkt(dele)}${halen ? ` ${halen}` : ""}`);
}
