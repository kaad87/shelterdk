import type { AffiliateProduct } from "@/lib/affiliate-products";
import { helTekst } from "@/lib/feed-beskrivelse";
import { rentMaerke, rentNavn } from "@/lib/produktnavn";

type P = Pick<
  AffiliateProduct,
  | "id"
  | "product_name"
  | "brand"
  | "display_name"
  | "display_brand"
  | "ean"
  | "description"
  | "image_url"
  | "price"
  | "affiliate_url"
  | "retailer"
  | "in_stock"
  | "shipping_cost"
>;

export interface ProductSchemaOpts {
  /** Redaktionel score 0-10 → Review med stjerner. */
  score?: number | null;
  /** Redaktionelle plusser → review.positiveNotes (pros/cons i SERP). */
  pros?: string[];
  /** Redaktionelle minusser → review.negativeNotes. */
  cons?: string[];
  /** Redaktionel note → review.reviewBody. */
  reviewBody?: string | null;
  /**
   * Priserne hos de butikker der foerer samme model, billigst foerst.
   *
   * Uden den beskriver skemaet kun den ene butik siden tilhoerer, mens siden
   * selv staar med "laveste pris nu" fra en anden. Google sammenligner
   * skemaets pris med den synlige, og en side der viser 850 kr. og
   * annoncerer 959,95 i skemaet er en prisuoverensstemmelse. Med flere
   * butikker bliver det derfor et AggregateOffer med lav og hoej pris.
   */
  tilbud?: { retailer: string; id: string; price: number; affiliate_url: string }[];
}

/**
 * Returret pr. forhandler (Search Console: hasMerchantReturnPolicy).
 * Backpackerlife reklamerer med 100 dages returret; øvrige sættes til de
 * lovpligtige 14 dages fortrydelsesret for dansk nethandel.
 */
const RETURN_DAYS: Record<string, number> = {
  backpackerlife: 100,
  outmore: 14,
  outdoortid: 14,
};

function returnPolicy(retailer: string): Record<string, unknown> {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "DK",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: RETURN_DAYS[retailer] ?? 14,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  };
}

/**
 * Stregkoden, naar den er en gyldig EAN13.
 *
 * Feedets egen `ean` foerst: den findes paa 37% af guide-varerne, mens
 * udledningen fra id'et kun virker for Outmore, hvis id'er ER EAN-numre.
 * Uden den stod produktsiderne uden gtin13, og stregkoden er den staerkeste
 * identifikator Google og en sprogmodel har til at vide hvilken vare der er
 * tale om.
 */
function gtin13(p: Pick<P, "id" | "ean">): string | null {
  const fraFeed = (p.ean ?? "").trim();
  if (ean13Gyldig(fraFeed)) return fraFeed;
  const fraUpc = upcTilEan13(fraFeed);
  if (fraUpc) return fraUpc;
  return gtin13FromId(p.id);
}

/**
 * Kontrolcifret i en EAN13. Vaegtene er 1 og 3 skiftevis fra foerste ciffer.
 *
 * Et forkert gtin er vaerre end intet: Google matcher varen mod et andet
 * produkt. Maalt 2. november 2026 bestod alle 104 feed-koder og alle 61
 * id-udledte, saa valideringen fjerner ingenting i dag og fanger den dag et
 * feed sender vroevl.
 */
function ean13Gyldig(kode: string): boolean {
  if (!/^\d{13}$/.test(kode)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(kode[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(kode[12]);
}

/**
 * UPC-A (12 cifre) som EAN13.
 *
 * Et nul foran er hele konverteringen, og kontrolcifret er uaendret: EAN13
 * vejer position 1 med 1, og nullet bidrager derfor ingenting, hvorefter de
 * resterende cifre faar praecis de vaegte UPC-A gav dem. De amerikanske
 * maerker i feedene skriver UPC: Keen, Salomon, Gerber, Coghlans. 29 af de
 * 362 guide-varer har en 12-cifret kode, og 28 af dem er gyldige; den sidste
 * falder paa kontrolcifret og faar derfor ingen gtin.
 */
function upcTilEan13(kode: string): string | null {
  if (!/^\d{12}$/.test(kode)) return null;
  const ean = "0" + kode;
  return ean13Gyldig(ean) ? ean : null;
}

/** Outmore-id'er er rene EAN13-numre ("outmore-5709388146854"). */
function gtin13FromId(id: string): string | null {
  const num = (id ?? "").split("-").slice(1).join("-");
  return ean13Gyldig(num) ? num : null;
}

function notesList(notes: string[]): Record<string, unknown> {
  return {
    "@type": "ItemList",
    itemListElement: notes.map((name, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
    })),
  };
}

/** Rullende gyldighed: priser synces dagligt + ISR, 30 dage er konservativt. */
function priceValidUntil(): string {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

/**
 * JSON-LD Product med offers (pris i DKK, ærlig lagerstatus). Hvis `score`
 * (0-10) er sat, tilføjes et redaktionelt Review (forfattet af ShelterDK) med
 * pros/cons som positiveNotes/negativeNotes → review-stjerner og +/− i Google.
 * Kun for tredjeparts-produkter (grej), jf. Googles guidelines.
 */
export function buildProductSchema(p: P, opts: ProductSchemaOpts = {}): Record<string, unknown> {
  const { score, pros, cons, reviewBody, tilbud } = opts;
  // Navn og mærke udledes samme sted som på kortene og i llms.txt, så Google
  // og en chatbot ser den samme entitet som brugeren. Se lib/produktnavn.ts.
  const brand = rentMaerke(p);
  const gtin = gtin13(p);
  // Forhandlernes feeds klipper beskrivelsen midt i et ord; teksten går ellers
  // ordret videre til Google. Se lib/feed-beskrivelse.ts.
  const description = helTekst(p.description, 500);
  return {
    "@type": "Product",
    name: rentNavn(p),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(gtin ? { gtin13: gtin } : {}),
    ...(description ? { description } : {}),
    image: p.image_url,
    ...(score != null
      ? {
          review: {
            "@type": "Review",
            author: { "@type": "Organization", name: "ShelterDK" },
            reviewRating: { "@type": "Rating", ratingValue: score, bestRating: 10, worstRating: 0 },
            ...(reviewBody ? { reviewBody } : {}),
            ...(pros && pros.length > 0 ? { positiveNotes: notesList(pros) } : {}),
            ...(cons && cons.length > 0 ? { negativeNotes: notesList(cons) } : {}),
          },
        }
      : {}),
    offers:
      tilbud && tilbud.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "DKK",
            lowPrice: Math.min(...tilbud.map((t) => t.price)),
            highPrice: Math.max(...tilbud.map((t) => t.price)),
            offerCount: tilbud.length,
            offers: tilbud.map((t) => ({
              "@type": "Offer",
              price: t.price,
              priceCurrency: "DKK",
              priceValidUntil: priceValidUntil(),
              availability: "https://schema.org/InStock",
              url: t.affiliate_url,
              seller: { "@type": "Organization", name: t.retailer },
              hasMerchantReturnPolicy: returnPolicy(t.retailer),
            })),
          }
        : enkeltTilbud(p, tilbud?.[0]),
  };
}

/**
 * Offer naar der kun er én butik.
 *
 * `valgt` er den raekke SIDEN viser, og den er ikke altid `p`. samlTilbud
 * folder butikkens varianter sammen til den billigste der kan koebes, saa
 * Petzl Swift RL staar som 799,95 (Black/Orange) paa siden, mens guidens egen
 * raekke er den hvide til 903,95. Uden `valgt` annoncerede skemaet 903,95
 * under en side der skrev 799,95: den prisuoverensstemmelse ramte 7 af de 362
 * sider, maalt 2. november 2026.
 *
 * Lagerstatus foelger med: naar den valgte raekke ikke er `p`, er den kommet
 * gennem samlTilbuds in_stock-filter og kan altsaa koebes.
 */
function enkeltTilbud(
  p: P,
  valgt?: { id: string; price: number; affiliate_url: string }
): Record<string, unknown> {
  const pris = valgt ? valgt.price : p.price;
  const url = valgt ? valgt.affiliate_url : p.affiliate_url;
  const paaLager = valgt && valgt.id !== p.id ? true : p.in_stock;
  return {
    "@type": "Offer",
    price: pris,
    priceCurrency: "DKK",
    priceValidUntil: priceValidUntil(),
    availability: paaLager ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url,
    hasMerchantReturnPolicy: returnPolicy(p.retailer),
    ...(p.shipping_cost != null
      ? {
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingRate: {
              "@type": "MonetaryAmount",
              value: p.shipping_cost,
              currency: "DKK",
            },
            shippingDestination: {
              "@type": "DefinedRegion",
              addressCountry: "DK",
            },
          },
        }
      : {}),
  };
}

/** JSON-LD ItemList over de rangerede produkter (rich results), med review pr. produkt. */
export function buildItemListSchema(
  items: { product: P; score?: number | null; pros?: string[]; cons?: string[]; reviewBody?: string | null }[],
  pageUrl: string
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: buildProductSchema(it.product, {
        score: it.score,
        pros: it.pros,
        cons: it.cons,
        reviewBody: it.reviewBody,
      }),
    })),
  };
}
