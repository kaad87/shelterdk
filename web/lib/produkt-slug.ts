import { rentNavn } from "./produktnavn";

/**
 * URL-segment til produktsiden, /grej/[slug].
 *
 * Kan ikke bruge slugifySegment fra lib/slug.ts, som er bygget til danske
 * stednavne: den smider alt der ikke er a-z0-9 vaek, uden at translitterere
 * foerst. Paa produktnavne betyder det at "Haglöfs" bliver "haglfs" og
 * "66°North" bliver "66north", hvor det foerste er ulaeseligt og det andet
 * tilfaeldigvis rigtigt. Kataloget har maalt 1. november 2026 ö, ä, é, ñ, °,
 * ™ og ² i navnene, saa translitterering er ikke en kantsituation.
 *
 * Slugget laves af rentNavn(), ikke af feedets raa navn, saa URL'en ikke
 * indeholder "sovepose-treklife-horizon-220-4-saesons" med typeordet foran.
 */

/**
 * ae/oe/aa som i resten af sitet, saa /grej matcher /danmark og /bedste.
 * De staar foer NFD-nedbrydningen, fordi å ellers bliver til "a" + ring og
 * dermed til "a" i stedet for "aa".
 */
const DANSKE: [RegExp, string][] = [
  [/æ/g, "ae"],
  [/ø/g, "oe"],
  [/å/g, "aa"],
];

/** Tegn NFD ikke kan dele op, fordi de ikke er bogstav + accent. */
const SAERLIGE: [RegExp, string][] = [
  [/ß/g, "ss"],
  [/đ|ð/g, "d"],
  [/þ/g, "th"],
  [/ł/g, "l"],
  [/°/g, "-"],
  [/[&+]/g, "-"],
];

/**
 * Smaa bogstaver uden accenter, men MED de danske bogstaver skrevet ud.
 *
 * NFD deler kun bogstav plus accent op ("ö" bliver "o" + U+0308). Den rører
 * ikke ø, som er et bogstav med streg igennem og ikke en accent, saa et
 * efterfoelgende [^a-z0-9]-filter ville lave "Stormkøkken" om til
 * "stormk kken". Derfor skal æ, ø og å skrives ud FOER NFD.
 *
 * Bruges baade af produktSlug() og af matchningen i lib/produkt-match.ts, saa
 * URL'en og matchnoeglen aldrig kan vaere uenige om hvad et navn hedder.
 */
export function translitterer(s: string): string {
  let ud = s.toLowerCase();
  for (const [fra, til] of DANSKE) ud = ud.replace(fra, til);
  for (const [fra, til] of SAERLIGE) ud = ud.replace(fra, til);
  return ud.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function produktSlug(navn: string | null | undefined): string {
  if (!navn) return "";
  return translitterer(navn)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface SlugVare {
  id: string;
  product_name: string;
  brand: string | null;
  display_name: string | null;
  display_brand: string | null;
}

/** En vare der ikke fik sin egen side, og hvorfor. */
export interface UdenProduktside {
  id: string;
  navn: string;
  grund: "kollision" | "tomt-navn";
  /** Ved kollision: id'et paa den vare der fik slug'en. */
  taberFor?: string;
  slug?: string;
}

export interface SlugTildeling {
  slugs: Map<string, string>;
  uden: UdenProduktside[];
}

/**
 * Fordeler produktside-slugs mellem varer, og siger hvem der ikke fik en.
 *
 * To varer kan faa samme slug, fordi rentNavn() kan give dem det samme NAVN.
 * Saa findes siden kun for den ene, og den anden har ingen. Vinderen er den
 * med det laveste id, saa den samme vare faar den samme URL ved hver bygning.
 *
 * Reglen ligger her og ikke i produktIndeks, fordi to ting skal vaere enige om
 * den: ruten, der bygger siderne, og det daglige sundhedstjek, der skal kunne
 * opdage at en vare har mistet sin side. Var reglen skrevet to gange, ville
 * tjekket stille og roligt holde op med at maale det ruten faktisk goer.
 */
export function tildelProduktSlugs(varer: SlugVare[]): SlugTildeling {
  const slugs = new Map<string, string>();
  const ejerAfSlug = new Map<string, string>();
  const uden: UdenProduktside[] = [];

  for (const vare of [...varer].sort((a, b) => a.id.localeCompare(b.id))) {
    const navn = rentNavn(vare);
    const slug = produktSlug(navn);
    if (!slug) {
      uden.push({ id: vare.id, navn: vare.product_name, grund: "tomt-navn" });
      continue;
    }
    const ejer = ejerAfSlug.get(slug);
    if (ejer) {
      uden.push({ id: vare.id, navn, grund: "kollision", taberFor: ejer, slug });
      continue;
    }
    ejerAfSlug.set(slug, vare.id);
    slugs.set(vare.id, slug);
  }

  return { slugs, uden };
}
