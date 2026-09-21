/**
 * Træ-shelters til haven fra Sølund Huse (Partner-ads, 5% provision).
 *
 * Hvorfor hårdkodet og ikke i affiliate_products: annoncøren har intet
 * produktfeed, og kataloget er fire varer der ændrer sig et par gange om året.
 * Prisen for det er, at det kan rådne — præcis som de 37 døde picks i
 * købsguiderne. Derfor: `PRICES_CHECKED` vises på siden, `isPriceStale`
 * skjuler priserne når de er for gamle, og scripts/check-partner-shelters.ts
 * verificerer link + pris.
 *
 * Baggrund: /koeb-shelter har 5.551 visninger/28 dage, hvoraf 39% er ren
 * købsintent ("shelter køb", "shelter pris", "shelter til salg"), plus ~530
 * visninger/90 dage på trækonstruktion ("fuldtømmer", "rundtømmer", "shelters
 * i træ"). Ingen af vores tre grej-forhandlere sælger den slags.
 */

const ADVERTISER_HOST = "solundhuse.dk";
const PARTNER_ID = "19557";
const BANNER_ID = "110103";

/** Dato hvor priserne sidst er verificeret mod annoncørens site. */
export const PRICES_CHECKED = "2026-09-21";

export interface PartnerShelter {
  /** Produktnavn som annoncøren kalder det. */
  name: string;
  url: string;
  priceDkk: number;
  /** Før-pris når varen er på tilbud hos annoncøren. */
  priceOriginalDkk?: number;
  areaM2?: number;
  /** Kort, faktuel beskrivelse — ingen superlativer vi ikke kan bakke op. */
  note: string;
  /** Tilbehør vises adskilt fra selve shelterne. */
  accessory?: boolean;
}

/** Billigste først: prisspændet skal kunne læses oppefra. */
export const PARTNER_SHELTERS: PartnerShelter[] = [
  {
    name: "Shelter 1 – 3,6 m² samlesæt",
    url: "https://solundhuse.dk/produkt/shelter-1-samlesaet-36-m2/",
    priceDkk: 18999,
    areaM2: 3.6,
    note: "Samlesæt i træ til to personer. Tilskårne dele og vejledning følger med.",
  },
  {
    name: "Shelter 2 – 6,6 m² samlesæt",
    url: "https://solundhuse.dk/produkt/shelter-udeliv/",
    priceDkk: 20799,
    priceOriginalDkk: 22199,
    areaM2: 6.6,
    note: "Større model med plads til en familie. Samme samlesæt-princip.",
  },
  {
    name: "Cover med myggenet til Shelter 1",
    url: "https://solundhuse.dk/produkt/cover-med-myggenet-til-shelter-1/",
    priceDkk: 4199,
    note: "Lukker åbningen med myggenet — gør shelteret brugbart i juli.",
    accessory: true,
  },
  {
    name: "Cover med myggenet til Shelter 2",
    url: "https://solundhuse.dk/produkt/cover-myggenet-shelter-2/",
    priceDkk: 5799,
    note: "Samme, til den store model.",
    accessory: true,
  },
];

/** Partner-ads klik-link med deep link til produktsiden. */
export function partnerAdsLink(productUrl: string): string {
  let host: string;
  try {
    host = new URL(productUrl).host.replace(/^www\./, "");
  } catch {
    host = "";
  }
  if (host !== ADVERTISER_HOST) {
    throw new Error(`partnerAdsLink: forventede ${ADVERTISER_HOST}, fik "${host}"`);
  }
  return `https://www.partner-ads.com/dk/klikbanner.php?partnerid=${PARTNER_ID}&bannerid=${BANNER_ID}&htmlurl=${productUrl}`;
}

export function formatDkk(n: number): string {
  return `${new Intl.NumberFormat("da-DK").format(n)} kr.`;
}

/** Priser ældre end 60 dage vises ikke — så står der "se aktuel pris" i stedet. */
export function isPriceStale(checked: string, now: Date = new Date()): boolean {
  const days = (now.getTime() - new Date(checked).getTime()) / 86_400_000;
  return days > 60;
}
