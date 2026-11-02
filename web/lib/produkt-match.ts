/**
 * Finder den SAMME model hos andre butikker, saa produktsiden kan vise en
 * aerlig prissammenligning.
 *
 * Hvorfor ikke EAN? Fordi den ikke virker. Maalt 1. november 2026: 2.422 af
 * varerne har slet ingen EAN (backpackerlife 2.101), og de butikker der HAR
 * en, bruger en ny EAN pr. stoerrelse. Keen Arroyo II staar som 887194014705
 * hos Pro-Outdoor og 887194014668 hos Outdoornu: samme sko, to numre. EAN
 * fandt 82 overlap, maerke plus model fandt 2,5 gange flere.
 *
 * Hvorfor ikke rentNavn()? Fordi den arbejder paa segmenter delt med " - ",
 * og de butikker der skriver maerket foerst har ingen segmenter: "Keen Mens
 * Arroyo II" og "Keen Arroyo II Men" er samme sko, men rentNavn rammer ikke
 * "Mens" og "Men", fordi der ikke er noget at skaere. Matchningen har derfor
 * sin egen normalisering, der arbejder paa ord i stedet for paa segmenter.
 *
 * Reglen er bevidst streng: samme kategori, samme maerke, og NOEJAGTIG samme
 * maengde modelord. Delmaengde-match blev proevet og flettede "Sea To Summit
 * Telos Tr3 Bigfoot Footprint" til 668 kr. med selve teltet til 4.840 kr. og
 * med "Telos Tr3 Plus" til 5.520 kr. Hellere vise én butik end en forkert
 * pris: siden siger selv at den kun fandt varen ét sted.
 */
import { rentMaerke } from "@/lib/produktnavn";
import { translitterer } from "@/lib/produkt-slug";

export interface MatchVare {
  id: string;
  retailer: string;
  product_name: string;
  brand: string | null;
  display_name?: string | null;
  display_brand?: string | null;
  category_mapped: string | null;
  price: number;
  affiliate_url: string;
  in_stock: boolean;
  is_blocked?: boolean;
}

/** Koen. Samme sko saelges som "Mens", "Men", "herre" og "M". */
const KOEN =
  /^(?:mens?|herre|herrer|herres|womens?|woman|dame|damer|dames|unisex|kids?|junior|boys?|girls?|boern|børn)$/i;

/**
 * Farver. Maalt mod kataloget: de her 40 daekker de farveord der staar som
 * selvstaendigt ord i et produktnavn. Listen er lukket med vilje, saa et
 * modelnavn som "Black Diamond" eller "Orange Peak" ikke bliver aedt: maerket
 * er allerede fjernet, naar farverne fjernes.
 */
const FARVE =
  /^(?:sort|hvid|graa|grå|groen|grøn|blaa|blå|roed|rød|gul|brun|beige|lilla|pink|orange|navy|khaki|oliven|olive|black|white|grey|gray|green|blue|red|yellow|brown|purple|charcoal|teal|burgundy|sand|stone|slate|forest|midnight|mint|coral|rust|ivory|cream|silver|gold|bronze|camo)$/i;

/** Ord der annoncerer en stoerrelse. Ordet SELV og ordet efter ryger. */
const STOERRELSESORD = /^(?:str|str\.|size|storlek|uk|eu|us)$/i;

/**
 * Rene stoerrelsesangivelser: "xl", "xxl", "42-45", "1/3".
 *
 * Decimaltal staar bevidst IKKE her. "Isg 2.0" og "Rila 4.0" er modelnumre,
 * og de er langt mere almindelige i navnene end decimalstoerrelser, som
 * naesten altid har "str." eller "uk" foran og dermed fanges af
 * STOERRELSESORD.
 */
const STOERRELSE = /^(?:x{0,3}[sl]|m|xx?l|\d{1,2}\/\d|\d{2}-\d{2})$/i;

/**
 * Tilbehoer. Et footprint, et inderteltet eller en pose er IKKE teltet. Ordene
 * fjernes ikke, de sammenlignes: staar et af dem paa den ene vare og ikke paa
 * den anden, er det ikke samme produkt. Det var den fejl der flettede et
 * footprint til 668 kr. sammen med teltet til 4.840 kr.
 */
const TILBEHOER =
  /^(?:footprint|underlag|gulv|floor|inner|innertelt|indertelt|outer|ydertelt|cover|betraek|betræk|pose|bag|case|etui|taske|reservedel|spare|kit|handle|haandtag|håndtag|laag|låg|lid|strap|rem|pole|stang|peg|ploek|pløk)$/i;

/** Maaleord der ER en del af identiteten: en 20-liters saek er ikke en 8-liters. */
const MAAL = /^\d+(?:[,.]\d+)?(?:l|liter|ltr|ml|cl|oz|g|kg|cm|mm|m|w|lm|mah|p|personer)$/i;

function nrm(s: string): string {
  // translitterer() skriver æ, ø og å ud, hvilket NFD ikke goer. Uden det
  // blev "Stormkøkken" til ordene "stormk" og "kken".
  return translitterer(s)
    // Decimalkommaet holdes sammen, foer alt andet bliver til mellemrum:
    // ellers blev "Isg 2.0" til ordene "2" og "0", og "Rila 4.0" kunne ikke
    // skelnes fra "Rila 4" paa andet end et loest nul.
    .replace(/(\d)[.,](\d)/g, "$1p$2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Ordene i navnet der identificerer modellen.
 *
 * Returnerer et SORTERET SAET, ikke en liste: feedene skriver ordene i
 * forskellig raekkefoelge ("Keen Mens Arroyo II" mod "Keen Arroyo II Men"),
 * og dubletter siger intet om identitet.
 */
export function modelOrd(v: MatchVare): string[] {
  const maerke = rentMaerke(v);
  let navn = nrm(v.product_name);
  const nm = maerke ? nrm(maerke) : "";
  if (nm) {
    // Maerket kan staa flere gange ("Trek n' eat Trek'n Eat Jaegergryde").
    navn = navn.replace(new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
  }
  const raa = navn.split(/\s+/).filter(Boolean);

  const ud: string[] = [];
  for (let i = 0; i < raa.length; i++) {
    const o = raa[i];
    if (STOERRELSESORD.test(o)) {
      i++; // ordet efter "str" er stoerrelsen
      continue;
    }
    if (KOEN.test(o) || FARVE.test(o)) continue;
    // En ren stoerrelse ryger, men kun naar den ikke er et maal med enhed:
    // "m" er medium, "20l" er tyve liter.
    if (STOERRELSE.test(o) && !MAAL.test(o)) continue;
    ud.push(o);
  }
  return [...new Set(ud)].sort();
}

/** Tilbehoersordene i navnet, som skal vaere ens paa begge sider. */
function tilbehoer(ord: string[]): string[] {
  return ord.filter((o) => TILBEHOER.test(o)).sort();
}

/**
 * Noeglen to varer skal dele for at vaere samme model. Null betyder "kan ikke
 * matches": uden maerke eller uden kategori er der ikke nok til at vaere
 * sikker, og saa vises varen alene.
 */
export function matchNoegle(v: MatchVare): string | null {
  if (!v.category_mapped) return null;
  const maerke = rentMaerke(v);
  if (!maerke) return null;
  const ord = modelOrd(v);
  // Et navn der kun var maerke, koen og farve siger intet om modellen.
  if (ord.length === 0) return null;
  return `${v.category_mapped}|${nrm(maerke)}|${ord.join(" ")}|${tilbehoer(ord).join(" ")}`;
}

export interface Tilbud {
  retailer: string;
  id: string;
  price: number;
  /**
   * Butikkens EGET navn paa den variant prisen gaelder. Farve er ikke en del
   * af identiteten, saa den billigste Silva Smini hos én butik kan vaere mint
   * og hos en anden sort. Siden skriver derfor butikkens navn ved prisen i
   * stedet for at lade som om det er samme vare ned til farven.
   */
  navn: string;
  /** Linket til netop den variant prisen gaelder. */
  affiliate_url: string;
  /** Samme vare kan ligge som én raekke pr. stoerrelse; her er der talt. */
  varianter: number;
}

/**
 * Butikkerne der foerer samme model som `vare`, inklusive den selv, billigst
 * foerst.
 *
 * Butikker med én raekke pr. stoerrelse (Outdoornu har "…-45" i id'et) ville
 * ellers fylde listen med den samme sko ti gange. Der vises én pris pr.
 * butik, den laveste der kan koebes, og hvor mange varianter den daekker.
 */
export function samlTilbud(vare: MatchVare, katalog: MatchVare[]): Tilbud[] {
  const noegle = matchNoegle(vare);
  const kandidater = katalog.filter((k) => k.in_stock && !k.is_blocked);

  const samme = noegle
    ? kandidater.filter((k) => matchNoegle(k) === noegle)
    : kandidater.filter((k) => k.id === vare.id);

  // Varen selv skal med, ogsaa hvis den er udsolgt: det er den side vi staar paa.
  if (!samme.some((k) => k.id === vare.id)) samme.push(vare);

  const perButik = new Map<string, Tilbud>();
  for (const k of samme) {
    const haves = perButik.get(k.retailer);
    if (!haves) {
      perButik.set(k.retailer, {
        retailer: k.retailer,
        id: k.id,
        price: k.price,
        navn: k.product_name,
        affiliate_url: k.affiliate_url,
        varianter: 1,
      });
      continue;
    }
    haves.varianter++;
    if (k.price < haves.price) {
      haves.price = k.price;
      haves.id = k.id;
      haves.navn = k.product_name;
      haves.affiliate_url = k.affiliate_url;
    }
  }
  return [...perButik.values()].sort((a, b) => a.price - b.price);
}
