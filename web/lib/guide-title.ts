import type { GuideEntryWithProduct } from "@/lib/buying-guides";

/**
 * Holder tal-påstandene i en guides SEO-titel i overensstemmelse med lageret.
 *
 * `seo_title` er en gemt streng, men den indeholder tal der ændrer sig dagligt:
 * "6 favoritter, fra 119 kr." Feedet synkroniseres hver nat, produkter udgår,
 * og titlen bliver ikke rettet. Målt på de 30 publicerede guider lovede to af
 * dem et antal der ikke fandtes, og drikkedunk-titlen lovede både ét produkt
 * for meget og en startpris 10 kr. over den faktiske.
 *
 * Det er ikke kun kosmetik. Titlen er det Google viser, og en guide der lover
 * seks favoritter og viser fem udsolgte er præcis den oplevelse, der giver et
 * klik tilbage til resultatsiden. Derfor regnes tallene om ved rendering i
 * stedet for at blive vedligeholdt i hånden — så kan de ikke blive forældede.
 *
 * Kun påstande der faktisk står i titlen bliver rettet. En titel uden tal
 * røres ikke, så redaktionelle titler kan skrives frit.
 */

export interface TitelFakta {
  /** Produkter der kan købes nu — udsolgte og blokerede tæller ikke. */
  antal: number;
  /** Laveste pris blandt dem der kan købes, eller null hvis ingen kan. */
  fraPris: number | null;
}

export function titelFakta(entries: GuideEntryWithProduct[]): TitelFakta {
  const kan = entries.filter((e) => e.product.in_stock && !e.product.is_blocked);
  const priser = kan
    .map((e) => e.product.price)
    .filter((n): n is number => typeof n === "number");
  return {
    antal: kan.length,
    fraPris: priser.length > 0 ? Math.min(...priser) : null,
  };
}

/** Dansk tusindtalsseparator, så den rettede pris ser ud som den oprindelige. */
function kr(n: number): string {
  return new Intl.NumberFormat("da-DK").format(Math.round(n));
}

// "6 favoritter, fra 119 kr." og varianter med punktum som tusindtalsskilletegn.
const PÅSTAND =
  /\s*[–—-]\s*\d+\s+favorit(?:ter)?(?:,\s*fra\s*[\d.,]+\s*kr\.?)?/i;
const ANTAL = /(\d+)\s+(favorit(?:ter)?)/i;
const FRA_PRIS = /(fra\s*)([\d.,]+)(\s*kr)/i;

export function friskTitel(
  seoTitle: string | null,
  entries: GuideEntryWithProduct[]
): string | null {
  if (!seoTitle) return seoTitle;
  if (!ANTAL.test(seoTitle)) return seoTitle;

  const { antal, fraPris } = titelFakta(entries);

  // Ingen købbare produkter: en påstand om favoritter ville være usand, og
  // der findes ikke et lavere tal der gør den sand. Påstanden ryger ud, og
  // resten af titlen står — vi beholder altså siden og dens placering.
  if (antal === 0) {
    return seoTitle.replace(PÅSTAND, "").replace(/\s{2,}/g, " ").trim();
  }

  let ud = seoTitle.replace(ANTAL, (_, __, ord: string) =>
    `${antal} ${antal === 1 ? ord.replace(/ter$/i, "") : ord.endsWith("ter") ? ord : `${ord}ter`}`
  );
  if (fraPris != null) {
    ud = ud.replace(FRA_PRIS, (_, pre: string, __: string, post: string) =>
      `${pre}${kr(fraPris)}${post}`
    );
  }
  return ud;
}

// "Vi scorer 6 favoritter … fra 119 til 179 kr." eller "… 119–179 kr."
const BESK_ANTAL = /(\d+)\s+(favorit(?:ter)?)/i;
const BESK_SPÆND_FRA_TIL = /(fra\s*)([\d.,]+)(\s*til\s*)([\d.,]+)(\s*kr)/i;
const BESK_SPÆND_STREG = /([\d.,]+)\s*[–—]\s*([\d.,]+)(\s*kr)/i;
// Hele sætningen om favoritter, når der ikke er noget at love.
const BESK_PÅSTAND =
  /\s*(?:[–—-]\s*)?(?:Vi\s+scorer\s+)?\d+\s+favorit(?:ter)?[^.]*?(?:\.\s*|$)/i;

/**
 * Samme problem som i titlen: beskrivelsen lover et antal og et prisspænd, og
 * begge dele ændrer sig med feedet. Den vises i resultatsiden lige under
 * titlen, så et forældet spænd er lige så synligt som et forældet antal.
 */
export function friskBeskrivelse(
  seoDescription: string | null,
  entries: GuideEntryWithProduct[]
): string | null {
  if (!seoDescription) return seoDescription;
  if (!BESK_ANTAL.test(seoDescription)) return seoDescription;

  const kan = entries.filter((e) => e.product.in_stock && !e.product.is_blocked);
  const priser = kan
    .map((e) => e.product.price)
    .filter((n): n is number => typeof n === "number");

  if (kan.length === 0) {
    return seoDescription.replace(BESK_PÅSTAND, " ").replace(/\s{2,}/g, " ").trim();
  }

  let ud = seoDescription.replace(BESK_ANTAL, (_, __, ord: string) =>
    `${kan.length} ${kan.length === 1 ? ord.replace(/ter$/i, "") : ord.endsWith("ter") ? ord : `${ord}ter`}`
  );
  if (priser.length > 0) {
    const lav = kr(Math.min(...priser));
    const høj = kr(Math.max(...priser));
    ud = ud
      .replace(BESK_SPÆND_FRA_TIL, (_, a: string, __: string, b: string, ___: string, d: string) =>
        `${a}${lav}${b}${høj}${d}`)
      .replace(BESK_SPÆND_STREG, (_, __: string, ___: string, c: string) => `${lav}–${høj}${c}`);
  }
  return ud;
}
