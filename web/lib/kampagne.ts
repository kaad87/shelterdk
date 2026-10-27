import { createClient } from "@supabase/supabase-js";
import { fjernStoej } from "./deal-relevans";
import { getWhitelistedCategories } from "./affiliate-deals";
import type { AffiliateProduct } from "./affiliate-products";

/**
 * Datalaget bag de to sæsonsider: /black-friday og /julegaver.
 *
 * De to sider henter fra hver sin ende af huset med vilje.
 *
 *   Black Friday henter fra FEEDET, fordi siden handler om pris. Den skal
 *   kunne vise, hvad der faktisk er sat ned i dag, ogsaa i kategorier vi ikke
 *   har skrevet en guide om endnu.
 *
 *   Julegaver henter fra VORES EGNE GUIDER, fordi siden handler om, hvad der
 *   er godt. Et feed kan sortere 4.658 varer under 1.000 kr efter pris, men
 *   det kan ikke sige, hvilken én af dem man skal give. Det har vi allerede
 *   skrevet ned i 332 entries. Hvert gaveforslag linker tilbage til guiden,
 *   det kommer fra, saa siden ogsaa traekker de guider op, den laaner fra.
 */

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SELECT_COLUMNS =
  "id, retailer, brand, product_name, description, category_mapped, price, price_original, discount_pct, in_stock, stock_count, image_url, affiliate_url, is_blocked, shipping_cost";

/* ---------------------------------------------------------------- Black Friday */

/**
 * Black Friday er dagen efter den fjerde torsdag i november.
 *
 * Datoen regnes ud frem for at staa som en konstant, saa siden ikke skal
 * rettes hvert aar for at kunne sige, hvor laenge der er til. En glemt
 * konstant ville faa siden til at paastaa, at dagen er overstaaet, resten af
 * aaret efter.
 *
 * UTC hele vejen, saa serverens tidszone ikke flytter dagen.
 */
export function blackFridayDato(aar: number): Date {
  const foerste = new Date(Date.UTC(aar, 10, 1));
  // 4 = torsdag. Afstanden frem til den foerste torsdag, plus tre uger.
  const tilFoersteTorsdag = (4 - foerste.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(aar, 10, 1 + tilFoersteTorsdag + 21 + 1));
}

/** Hele dage fra `idag` til `dato`. Negativt tal = dagen er passeret. */
export function dageTil(dato: Date, idag: Date): number {
  const d = Date.UTC(dato.getUTCFullYear(), dato.getUTCMonth(), dato.getUTCDate());
  const n = Date.UTC(idag.getUTCFullYear(), idag.getUTCMonth(), idag.getUTCDate());
  return Math.round((d - n) / 86_400_000);
}

export interface BlackFridayStatus {
  dato: Date;
  aar: number;
  dage: number;
  /** Selve dagen, eller weekenden og Cyber Monday lige efter. */
  erIGang: boolean;
}

/**
 * Hvilken Black Friday siden skal tale om, og hvor langt der er til den.
 *
 * Fra Cyber Monday og frem peger siden paa naeste aar. Ellers ville den fra
 * december til november staa og sige "0 dage" om en dag, der var overstaaet.
 */
export function blackFridayStatus(idag: Date): BlackFridayStatus {
  let aar = idag.getUTCFullYear();
  let dato = blackFridayDato(aar);
  // 3 = fredag, loerdag, soendag, mandag (Cyber Monday).
  if (dageTil(dato, idag) < -3) {
    aar += 1;
    dato = blackFridayDato(aar);
  }
  const dage = dageTil(dato, idag);
  return { dato, aar, dage, erIGang: dage <= 0 && dage >= -3 };
}

/**
 * Er prisfaldet aegte?
 *
 * discount_pct er regnet ud af feedet, og for ca. 97 % af varerne er
 * foer-prisen den samme som nu-prisen, fordi forhandleren sender listeprisen
 * i begge felter. En vare uden et foer, der er hoejere end nu, er ikke sat
 * ned, uanset hvad discount_pct siger. Kravet staar her frem for i en
 * .gte()-klausul, saa det ogsaa gaelder, hvis et feed en dag sender en
 * discount_pct, der ikke stemmer med sine egne to priser.
 */
export function aegteRabat(p: Pick<AffiliateProduct, "price" | "price_original">): boolean {
  const nu = p.price ?? 0;
  const foer = p.price_original ?? 0;
  return nu > 0 && foer > nu;
}

/** Rabatten regnet af de to priser, ikke af feedets eget felt. */
export function rabatPct(p: Pick<AffiliateProduct, "price" | "price_original">): number {
  if (!aegteRabat(p)) return 0;
  return Math.round((1 - (p.price ?? 0) / (p.price_original ?? 1)) * 100);
}

export interface KampagneUdvalg {
  varer: AffiliateProduct[];
  /** Den laveste rabat i det viste udvalg. Siden siger tallet hoejt. */
  minRabat: number;
  /** Hvor mange aegte nedsatte varer der var at vaelge imellem i alt. */
  kandidater: number;
}

/**
 * Vaelger kampagnens varer: stoerste rabat foerst, men hoejst et par stykker
 * pr. kategori, saa siden ikke bliver 40 soveposer.
 *
 * Grænsen er ikke fast. Den 27. oktober 2026 havde feedet 166 varer med 25 %
 * eller mere, og paa selve Black Friday er der flere. En fast grænse ville
 * enten give en tom side uden for ugen eller en udvandet side i ugen. Derfor
 * fyldes pladserne oppefra, og siden oplyser bagefter, hvad den laveste rabat
 * i udvalget blev.
 */
export function vaelgKampagneTilbud(
  varer: AffiliateProduct[],
  opts: { maalAntal: number; maxPrKategori: number }
): KampagneUdvalg {
  const nedsat = varer
    .filter(aegteRabat)
    .sort((a, b) => rabatPct(b) - rabatPct(a) || (a.price ?? 0) - (b.price ?? 0));

  const valgt: AffiliateProduct[] = [];
  const brugt = new Map<string, number>();
  for (const v of nedsat) {
    if (valgt.length >= opts.maalAntal) break;
    const kat = v.category_mapped ?? "ukendt";
    const n = brugt.get(kat) ?? 0;
    if (n >= opts.maxPrKategori) continue;
    valgt.push(v);
    brugt.set(kat, n + 1);
  }

  return {
    varer: valgt,
    minRabat: valgt.length ? rabatPct(valgt[valgt.length - 1]) : 0,
    kandidater: nedsat.length,
  };
}

export async function getKampagneTilbud(
  opts: { maalAntal?: number; maxPrKategori?: number } = {}
): Promise<KampagneUdvalg> {
  const kategorier = await getWhitelistedCategories();
  if (kategorier.length === 0) return { varer: [], minRabat: 0, kandidater: 0 };

  const { data } = await sb()
    .from("affiliate_products")
    .select(SELECT_COLUMNS)
    .eq("in_stock", true)
    .eq("is_blocked", false)
    .gte("price", 100)
    .gt("discount_pct", 0)
    .in("category_mapped", kategorier)
    .order("discount_pct", { ascending: false })
    .limit(400);

  return vaelgKampagneTilbud(fjernStoej((data as AffiliateProduct[]) ?? []), {
    maalAntal: opts.maalAntal ?? 36,
    maxPrKategori: opts.maxPrKategori ?? 3,
  });
}

/* -------------------------------------------------------------------- Julegaver */

export interface GaveTrin {
  /** Nedre graense, inklusiv. */
  fra: number;
  /** Oevre graense, eksklusiv. */
  til: number;
  overskrift: string;
  id: string;
}

/**
 * Prisbaand, ikke "under X" paa alle tre.
 *
 * En vare til 150 kr er ogsaa under 500 og under 1.000, saa tre "under"-trin
 * ville vise den samme kniv tre gange paa den samme side. Baandene gaar i
 * forlaengelse af hinanden, saa hvert forslag staar ét sted.
 */
export const GAVE_TRIN: GaveTrin[] = [
  { fra: 50, til: 200, overskrift: "Under 200 kr", id: "under-200" },
  { fra: 200, til: 500, overskrift: "200 til 500 kr", id: "200-500" },
  { fra: 500, til: 1000, overskrift: "500 til 1.000 kr", id: "500-1000" },
];

export interface Gaveforslag {
  product: AffiliateProduct;
  guideSlug: string;
  guideTitle: string;
  award: string | null;
  score: number | null;
  /** best_for fra guiden: den korte grund til at netop den her vare staar der. */
  bestFor: string | null;
}

/**
 * Fordeler kandidaterne paa trin: hoejeste score foerst, men kun ét forslag
 * pr. guide pr. trin.
 *
 * Uden graensen pr. guide bliver "Under 200 kr" til seks knive og fem huer,
 * fordi det er de guider, der har flest billige varer. Med den bliver det
 * seks forskellige slags gave, hvilket er det, siden skal kunne.
 */
export function fordelGaver(
  kandidater: Gaveforslag[],
  trin: GaveTrin[],
  prTrin: number
): { trin: GaveTrin; forslag: Gaveforslag[] }[] {
  return trin.map((t) => {
    const i = kandidater
      .filter((k) => {
        const pris = k.product.price ?? 0;
        return pris >= t.fra && pris < t.til;
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.product.price ?? 0) - (b.product.price ?? 0));

    const valgt: Gaveforslag[] = [];
    const brugteGuider = new Set<string>();
    for (const k of i) {
      if (valgt.length >= prTrin) break;
      if (brugteGuider.has(k.guideSlug)) continue;
      valgt.push(k);
      brugteGuider.add(k.guideSlug);
    }
    return { trin: t, forslag: valgt };
  });
}

export async function getGaveforslag(
  prTrin = 9
): Promise<{ trin: GaveTrin; forslag: Gaveforslag[] }[]> {
  const klient = sb();
  const { data: guider } = await klient
    .from("buying_guides")
    .select("id, slug, title")
    .eq("status", "published");
  const guideAf = new Map(
    (guider ?? []).map((g) => [g.id as string, { slug: g.slug as string, title: g.title as string }])
  );
  if (guideAf.size === 0) return fordelGaver([], GAVE_TRIN, prTrin);

  const { data: entries } = await klient
    .from("buying_guide_entries")
    .select("guide_id, rank, score, award_label, best_for, affiliate_product_id")
    .in("guide_id", [...guideAf.keys()]);
  if (!entries?.length) return fordelGaver([], GAVE_TRIN, prTrin);

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id as string))];
  const varer = new Map<string, AffiliateProduct>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await klient
      .from("affiliate_products")
      .select(SELECT_COLUMNS)
      .in("id", ids.slice(i, i + 200));
    for (const p of (data as AffiliateProduct[]) ?? []) varer.set(p.id, p);
  }

  const kandidater: Gaveforslag[] = [];
  for (const e of entries) {
    const p = varer.get(e.affiliate_product_id as string);
    const g = guideAf.get(e.guide_id as string);
    if (!p || !g || !p.in_stock || p.is_blocked) continue;
    kandidater.push({
      product: p,
      guideSlug: g.slug,
      guideTitle: g.title,
      award: (e.award_label as string | null) ?? null,
      score: (e.score as number | null) ?? null,
      bestFor: (e.best_for as string | null) ?? null,
    });
  }

  return fordelGaver(kandidater, GAVE_TRIN, prTrin);
}
