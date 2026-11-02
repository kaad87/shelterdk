/**
 * Datalaget bag /grej/[slug].
 *
 * Siden findes fordi guiderne svarer paa "hvilken skal jeg vaelge", mens
 * folk ogsaa soeger paa den enkelte vare: "Haglöfs Musca -13 pris", "Keen
 * Arroyo II test". De soegninger lander i dag ingen steder hos os.
 *
 * Udvalget er de 362 varer der staar i en udgivet guide, og KUN dem. De har
 * alle en score, mindst to fordele, en ulempe, et best_for og en redaktionel
 * vurdering, saa ingen af siderne bliver tynde. En side pr. katalogvare ville
 * give 13.391 sider uden et ord paa.
 */
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { getGuideBySlug, type BuyingGuide, type GuideEntryWithProduct } from "@/lib/buying-guides";
import { rentNavn, rentMaerke } from "@/lib/produktnavn";
import { tildelProduktSlugs, type SlugVare } from "@/lib/produkt-slug";
import { samlTilbud, type MatchVare, type Tilbud } from "@/lib/produkt-match";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export interface ProduktOpslag {
  slug: string;
  produktId: string;
  /** Guiden varen praesenteres ud fra. Staar den i flere, vindes af den bedste placering. */
  guideSlug: string;
  /** Oevrige guider varen ogsaa staar i. */
  ogsaaI: { slug: string; title: string }[];
}

export interface Prispunkt {
  observeret: string;
  price: number;
}

export interface ProduktSide {
  navn: string;
  maerke: string | null;
  slug: string;
  entry: GuideEntryWithProduct;
  guide: BuyingGuide;
  /** 1-baseret plads blandt de koebbare i guiden. */
  plads: number;
  antalIGuiden: number;
  /** Guidens foerstevalg, naar det ikke er denne vare. */
  foerstevalg: GuideEntryWithProduct | null;
  /** Naermeste billigere alternativ i guiden, naar der er et. */
  billigere: GuideEntryWithProduct | null;
  tilbud: Tilbud[];
  historik: Prispunkt[];
  ogsaaI: { slug: string; title: string }[];
}

/**
 * Alle produktsider, slug -> hvor varen hoerer hjemme.
 *
 * Bygges af rentNavn(), saa URL'en er det navn brugeren ser, og ikke feedets
 * "sovepose-treklife-horizon-220-4-saesons". Kollisioner er maalt til nul
 * 1. november 2026, men haandteres alligevel: de fem der kolliderede, gjorde
 * det fordi tre forskellige varer fik samme NAVN, og det er et problem
 * uanset URL'en. Vinderen er den med det laveste id, saa den samme vare faar
 * den samme URL ved hver bygning, og taberne udelades hellere end at faa en
 * URL ingen kan gaette.
 */
export const produktIndeks = cache(async (): Promise<Map<string, ProduktOpslag>> => {
  const db = sb();
  const { data: guider } = await db
    .from("buying_guides")
    .select("id, slug, title")
    .eq("status", "published");
  if (!guider?.length) return new Map();

  const guideEfterId = new Map(guider.map((g) => [g.id as string, g as { id: string; slug: string; title: string }]));

  const { data: entries } = await db
    .from("buying_guide_entries")
    .select("guide_id, affiliate_product_id, rank")
    .in("guide_id", [...guideEfterId.keys()]);
  if (!entries?.length) return new Map();

  const ids = [...new Set(entries.map((e) => e.affiliate_product_id as string))];
  const varer: { id: string; product_name: string; brand: string | null; display_name: string | null; display_brand: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await db
      .from("affiliate_products")
      .select("id, product_name, brand, display_name, display_brand")
      .in("id", ids.slice(i, i + 500));
    varer.push(...((data ?? []) as typeof varer));
  }
  const vareEfterId = new Map(varer.map((v) => [v.id, v]));

  // Pr. vare: den bedste placering vinder, saa produktsiden praesenterer den
  // der hvor redaktionen har rangeret den hoejest.
  const bedste = new Map<string, { guideSlug: string; rank: number }>();
  const alle = new Map<string, { slug: string; title: string }[]>();
  for (const e of entries) {
    const g = guideEfterId.get(e.guide_id as string);
    if (!g) continue;
    const pid = e.affiliate_product_id as string;
    const rank = (e.rank as number) ?? 999;

    const liste = alle.get(pid) ?? [];
    if (!liste.some((x) => x.slug === g.slug)) liste.push({ slug: g.slug, title: g.title });
    alle.set(pid, liste);

    const haves = bedste.get(pid);
    if (!haves || rank < haves.rank || (rank === haves.rank && g.slug < haves.guideSlug)) {
      bedste.set(pid, { guideSlug: g.slug, rank });
    }
  }

  // Slug-fordelingen ligger i tildelProduktSlugs, saa det daglige
  // sundhedstjek kan maale praecis den regel ruten bygger efter.
  const kandidater: SlugVare[] = [];
  for (const pid of bedste.keys()) {
    const vare = vareEfterId.get(pid);
    if (vare) kandidater.push(vare);
  }
  const { slugs } = tildelProduktSlugs(kandidater);

  const ud = new Map<string, ProduktOpslag>();
  for (const [pid, slug] of slugs) {
    const valgt = bedste.get(pid);
    if (!valgt) continue;
    ud.set(slug, {
      slug,
      produktId: pid,
      guideSlug: valgt.guideSlug,
      ogsaaI: (alle.get(pid) ?? []).filter((g) => g.slug !== valgt.guideSlug),
    });
  }
  return ud;
});

export async function getProduktSlugs(): Promise<string[]> {
  return [...(await produktIndeks()).keys()];
}

/**
 * produkt-id -> produktsidens slug, for de varer der faktisk har en side.
 *
 * Guidesiderne linker herigennem i stedet for selv at kalde
 * produktSlug(rentNavn(...)). To varer kan faa samme slug, og saa findes
 * siden kun for den ene; et udregnet link ville sende den anden vare hen paa
 * en side om noget andet. Opslaget kan kun give den slug der er bygget.
 */
export const produktSlugEfterId = cache(async (): Promise<Map<string, string>> => {
  const ud = new Map<string, string>();
  for (const [slug, opslag] of await produktIndeks()) ud.set(opslag.produktId, slug);
  return ud;
});

/**
 * Tilbud og prishistorik for én vare.
 *
 * Katalogopslaget er begraenset til varens egen kategori. Hele kataloget er
 * 18.000 raekker, og projektet har haft egress-overforbrug: en kategori er et
 * par hundrede. Matchningen kraever alligevel samme kategori, saa der tabes
 * ingenting ved det.
 */
async function hentTilbudOgHistorik(
  produkt: MatchVare
): Promise<{ tilbud: Tilbud[]; historik: Prispunkt[] }> {
  const db = sb();
  if (!produkt.category_mapped) {
    return {
      tilbud: samlTilbud(produkt, [produkt]),
      historik: await hentHistorik(db, [produkt.id]),
    };
  }

  const kandidater: MatchVare[] = [];
  for (let fra = 0; ; fra += 1000) {
    const { data } = await db
      .from("affiliate_products")
      .select("id, retailer, product_name, brand, display_name, display_brand, category_mapped, price, affiliate_url, in_stock, is_blocked, shipping_cost")
      .eq("category_mapped", produkt.category_mapped)
      .order("id")
      .range(fra, fra + 999);
    if (!data?.length) break;
    kandidater.push(...(data as MatchVare[]));
    if (data.length < 1000) break;
  }

  const tilbud = samlTilbud(produkt, kandidater);
  return { tilbud, historik: await hentHistorik(db, tilbud.map((t) => t.id)) };
}

async function hentHistorik(
  db: ReturnType<typeof sb>,
  ids: string[]
): Promise<Prispunkt[]> {
  if (ids.length === 0) return [];
  const { data } = await db
    .from("affiliate_price_history")
    .select("observeret, price")
    .in("product_id", ids)
    .order("observeret");
  if (!data?.length) return [];

  // Flere butikker kan have logget samme dag. Kurven viser den laveste pris
  // den dag, fordi det er den siden lover oeverst.
  const perDag = new Map<string, number>();
  for (const r of data) {
    const d = r.observeret as string;
    const p = Number(r.price);
    const haves = perDag.get(d);
    if (haves == null || p < haves) perDag.set(d, p);
  }
  return [...perDag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([observeret, price]) => ({ observeret, price }));
}

export const getProduktBySlug = cache(async (slug: string): Promise<ProduktSide | null> => {
  const opslag = (await produktIndeks()).get(slug);
  if (!opslag) return null;

  const data = await getGuideBySlug(opslag.guideSlug);
  if (!data) return null;
  const { guide, entries } = data;

  const entry = entries.find((e) => e.product.id === opslag.produktId);
  if (!entry) return null;

  // entries er allerede sorteret af rankGuideEntries: koebbare foerst, efter
  // rank. Pladsen taelles blandt de koebbare, saa en udsolgt vare ikke
  // paastaar at vaere nr. 9 af 11.
  const koebbare = entries.filter((e) => e.product.in_stock && !e.product.is_blocked);
  const plads = koebbare.findIndex((e) => e.product.id === opslag.produktId) + 1;

  const foerstevalg = koebbare[0] && koebbare[0].product.id !== opslag.produktId ? koebbare[0] : null;
  const billigere =
    koebbare
      .filter((e) => e.product.id !== opslag.produktId && e.product.price < entry.product.price)
      .sort((a, b) => b.product.price - a.product.price)[0] ?? null;

  const { tilbud, historik } = await hentTilbudOgHistorik(entry.product as unknown as MatchVare);

  return {
    navn: rentNavn(entry.product),
    maerke: rentMaerke(entry.product),
    slug,
    entry,
    guide,
    plads: plads > 0 ? plads : koebbare.length + 1,
    antalIGuiden: koebbare.length,
    foerstevalg,
    billigere,
    tilbud,
    historik,
    ogsaaI: opslag.ogsaaI,
  };
});
