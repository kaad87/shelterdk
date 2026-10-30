/**
 * Hvor mange varer vi faktisk gemmer fra et stort feed, og hvilke.
 *
 * `kategoriFor()` skaerer de 82.000 varer i Pro Outdoor og Outdoornu ned til
 * ca. 1.700 i seks kategorier. Det er stadig alt for mange: en guide viser
 * 6-8 produkter, og tabellen har i forvejen 98 % ubrugte raekker.
 *
 * Tre regler skaerer resten:
 *
 *  1. Varen skal kunne baere en guide: paa lager og med en beskrivelse, der er
 *     lang nok til at skrive ud fra. Uden tekst skal indholdet findes paa, og
 *     det er praecis den fejl der gjorde Outmore ubrugelig til guider.
 *  2. Farvevarianter og stoerrelser foldes til én model. Feedet har tretten
 *     raekker til samme sandal; en guide bruger én.
 *  3. Et loft pr. kategori.
 *
 * Loftet er det sted hvor det kan gaa galt, saa det er bygget klaebende: en
 * vare, vi allerede har gemt, beholder sin plads. Ellers kunne et nyt produkt,
 * der sorterer tidligere, skubbe et produkt ud, som en live guide peger paa,
 * og guidens entry ville pege paa en raekke der ikke findes. Loftet er derfor
 * en graense for hvor mange NYE varer der lukkes ind, ikke et tag paa tabellen.
 */

/** Minimum beskrivelseslaengde for at en vare kan baere guidetekst. */
export const MIN_TEKST = 40;

export interface UdvalgVare {
  id: string;
  brand: string | null;
  product_name: string;
  description: string | null;
  price: number;
  in_stock: boolean;
}

/**
 * Ord der afslutter et navn som stoerrelse.
 *
 * Bogstavstoerrelser, EU-numre, laengdevarianter og de skostoerrelser der er
 * skrevet med UK-omregning ("40 2/3 / UK 5"). Proeves kun paa det sidste led
 * efter et komma eller en bindestreg, saa "No. 16" midt i et navn er uroert.
 */
export const STOERRELSE =
  /^(?:x{0,3}[sl]|[sm]|[2-6]x?l|[sml]\s*\/\s*(?:m|x?l)|\d{2,3}(?:[.,]\d)?(?:\s+\d\/\d)?|regular|long|short|petite)$/i;

/**
 * Skostoerrelser i Outdoornu er skrevet med UK-omregning: "-38 2/3 / UK 5,5".
 * Halen fjernes foer loekken, fordi kommaet i "5,5" ellers er det sidste
 * skilletegn, og "5" alene ser ikke ud som en stoerrelse.
 */
const UK_HALE = /\s*\/\s*uk\s*[\d.,/ ]+$/i;

/**
 * Farveord. Bruges til at genkende det sidste led som en farve.
 *
 * En ordliste frem for "skaer altid det sidste led af", fordi det sidste led
 * lige saa ofte ER modellen: "Pinewood Furudal Hunter Pro vest-3XL" ender paa
 * "vest" naar stoerrelsen er vaek. Listen rammer ikke alt ("agave", "mustang",
 * "sabbia"), og det er med vilje den sikre vej: en farve vi ikke genkender
 * giver én model for meget, ikke to modeller slaaet forkert sammen.
 */
export const FARVE =
  /\b(black|sort|white|hvid|grey|gray|graa|grå|silver|charcoal|anthracite|antracite|navy|blue|blaa|blå|teal|petrol|green|groen|grøn|olive|forest|moss|khaki|sage|lime|red|roed|rød|chili|brick|burgundy|wine|brown|brun|tan|beige|sand|cream|camel|coffee|chocolate|suede|timber|earth|stone|slate|ink|pink|rose|coral|salmon|purple|lilac|violet|yellow|gul|orange|apricot|mustard|gold|bronze|copper|melange|camou|camo|multi|print|clay|rust|plum|birch|bungee|titanium|pebble|fossil|fosil|savanna|laurel|patina|terracotta|basalt|buckwheat|chalk|indigo|bordeaux|oatmeal|balsam|corsair|taupe|plaza|salvia|sabbia|nero|bianco|poplar|verbena|brindle|limestone|marine|bracken|magnet|citadel|cordovan|tusk|ember|graphite|granite|storm|dusty|mist|sage|willow|utility|glacial|seabird|bamboo|pitch|oar|basin|torrey|tarmac|antiguous|samba|oak|navy|agave|arona|oatmeal|mustang|sabbia|nero|bianco|pistacchio|avocado|corda|nude|tapioca|claqua|gull|walnut|atera|cactus|pelican|tobacco|bedrock|ebony|forge|taupe|cordovan|bombay|magnet|bracken|citadel|tundra|vintage)\b/i;

/**
 * Modelnavnet uden farve og stoerrelse, saa varianter af samme vare foldes.
 *
 * De to feeds skriver varianter forskelligt, og foerste udgave kendte kun den
 * ene. Pro Outdoor skriver "Abisko Trail Trousers Mens, Suede Brown", mens
 * Outdoornu skriver "Singi Down Jacket Women-black-L". Med kun komma-reglen
 * blev fire farver i fire stoerrelser seksten modeller, og dunjakke-loftet gik
 * til den samme jakke seksten gange.
 *
 * Koen staar foer farven i begge feeds, saa den er bevaret: en herre- og en
 * damemodel skal vaere to modeller.
 */
export function basisNavn(navn: string): string {
  let s = navn.trim().replace(UK_HALE, "");

  // Stoerrelser kan hobe sig op: "-44-regular", "-38 2/3 / UK 5,5".
  for (let i = 0; i < 4; i++) {
    const m = s.match(/[,-]\s*([^,-]+)$/);
    if (!m || m.index == null || !STOERRELSE.test(m[1].trim())) break;
    s = s.slice(0, m.index).trim();
  }

  // Og derefter farve-leddene. [^,-] og ikke [^,] er det der binder udtrykket
  // til det SIDSTE skilletegn. Med [^,] greb reglen den foerste bindestreg i
  // navnet, og "Zip-Off buks-green" blev "Zip": modellen forsvandt sammen med
  // farven.
  //
  // To runder, fordi Outdoornu skriver tofarvede varer med to led:
  // "Kaipak Fleece Men-dark navy-laurel green". Med én runde blev de fire
  // farvekombinationer fire modeller, og de fyldte fleece-loftet.
  for (let i = 0; i < 2; i++) {
    const f = s.match(/([,-])\s*([^,-]+)$/);
    if (!f || f.index == null || f.index === 0) break;
    // Et komma er altid et skilletegn. En bindestreg kan sidde inde i et ord,
    // og der skal hele leddet vaere farve. Se kunFarve().
    const erFarve = f[1] === "," ? FARVE.test(f[2]) : kunFarve(f[2]);
    if (!erFarve) break;
    s = s.slice(0, f.index).trim();
  }
  return s;
}

/**
 * Er leddet UDELUKKENDE farve?
 *
 * Bruges kun naar skilletegnet er en BINDESTREG. Et komma er altid et
 * skilletegn, og der er den loese proeve rigtig: "Women, peat/rainy/h.pink"
 * er et farveled, selv om ingen af de tre ord staar i FARVE. Et strengere
 * krav paa komma-leddet braekkede to af de eksisterende tests, fordi feedene
 * er fulde af farvenavne, vi ikke kan kende.
 *
 * Her laa fejlen. Reglen spurgte FARVE.test(led), altsaa om der var et
 * farveord et sted i leddet, og klippede saa hele leddet af. For et led, der
 * kun ER farve, er det rigtigt. Men bindestreger staar ogsaa midt i
 * modelnavne, og saa tog klippet en del af navnet med:
 *
 *   "Klymit V-seat Grey"                        -> "Klymit V"
 *   "PIEPS First-Aid Pro Black"                 -> "PIEPS First"
 *   "Altra Women's Olympus 6 Hike Low GORE-TEX" -> "... Hike Low GORE"
 *   "Swazi Ali-Gaiters Black"                   -> "Swazi Ali"
 *
 * Maalt paa Outnorth-feedet ramte det 50 af de 684 gemte varer, altsaa 7 %, og
 * navnet bliver ogsaa GEMT: synken skriver basisNavn() i product_name for
 * feeds med loft, saa det stod paa produktkortene. Gore-Tex var det hyppigste
 * moenster, fordi "TEX Black" indeholder et farveord.
 *
 * Nu skal HVERT ord i leddet vaere farve. "dark navy" klippes, "seat Grey" gaar
 * fri. Prisen er, at en vare med en farve, vi ikke genkender som et helt led,
 * giver én model for meget i foldningen. Det er den rigtige vej rundt: filens
 * egen regel er, at over-foldning er vaerre end under-foldning, fordi den
 * slaar to forskellige varer sammen til én.
 */
function kunFarve(led: string): boolean {
  // Skilletegn inde i leddet er ikke ord: "black/white" og "Black  Beauty" er
  // begge rene farveled.
  const ord = led.split(/[\s/]+/).filter(Boolean);
  if (!ord.length) return false;
  return ord.every((o) => FARVE.test(o) || MODIFIKATOR.test(o));
}

/**
 * Ord der staar sammen med en farve uden selv at vaere en.
 *
 * "dark navy", "true black", "mammut red-black" og "black beauty" er
 * farveled, og uden disse ord ville kravet om at hvert ord er en farve aldrig
 * kunne opfyldes for dem.
 *
 * Tal staar bevidst IKKE paa listen. Med \d+ blev "Lafayette Pannlampa
 * HL-23 Black" til "Lafayette Pannlampa HL", fordi "23 Black" saa ud som et
 * farveled. Modelnumre efter en bindestreg er almindelige, og en farve, der
 * kun bestaar af et tal, findes ikke.
 */
const MODIFIKATOR =
  /^(dark|light|lys|moerk|mørk|deep|pale|bright|true|pure|classic|vintage|washed|heather|melange|beauty|shade|tint|tone|and|og|&)$/i;

/**
 * Maerket, som udvalget skal regne med.
 *
 * Brand-feltet i Pro Outdoors feed er ikke paalideligt: to Aclima-fleecer har
 * brand=null mens resten har "Aclima", og en The North Face-hat staar med
 * "Columbia Sportswear". Et tomt felt var det vaerste af de to, fordi varen saa
 * blev sit eget maerke: Aclima fik fire pladser i fleece i stedet for to, baade
 * i maerkegraensen og i foldningen. Begge feeds skriver maerket som foerste ord
 * i produktnavnet, saa det er det der bruges, naar feltet er tomt.
 *
 * Kun til noegler og graenser. Det gemte brand-felt er feedets eget, for et
 * gaet hoerer ikke i databasen.
 */
function brandNoegle(v: UdvalgVare): string {
  const fra = (v.brand ?? "").trim().toLowerCase();
  if (fra) return fra;
  return (v.product_name.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

function modelNoegle(v: UdvalgVare, kategori: string): string {
  return `${kategori}|${brandNoegle(v)}|${basisNavn(v.product_name).toLowerCase()}`;
}

/**
 * Vaelger hvilke varer fra et feed der skal gemmes.
 *
 * @param varer      alt hvad feedet indeholder
 * @param kategorien kategorien en vare hoerer til, eller null for "lad ligge"
 * @param gemte      id'er vi allerede har i basen for dette feed
 * @param loft       hoejst saa mange modeller pr. kategori
 */
export function vaelgUdvalg<T extends UdvalgVare>(
  varer: T[],
  kategorien: (v: T) => string | null,
  gemte: ReadonlySet<string>,
  loft: number,
  maksPrBrandOverstyret?: number,
  loftOverstyring?: Readonly<Record<string, number>>
): { valgte: T[]; prKategori: Map<string, number> } {
  // 1 + 2: fold til én vare pr. model, inden for hver kategori.
  const modeller = new Map<string, { kategori: string; vare: T }>();
  for (const v of varer) {
    if (!v.in_stock) continue;
    if ((v.description ?? "").length < MIN_TEKST) continue;
    const kat = kategorien(v);
    if (!kat) continue;

    const noegle = modelNoegle(v, kat);
    const nuvaerende = modeller.get(noegle);
    if (!nuvaerende) {
      modeller.set(noegle, { kategori: kat, vare: v });
      continue;
    }
    // Repraesentanten vaelges klaebende foerst, saa den samme variant bliver
    // valgt i morgen: har vi allerede gemt én af dem, er det den. Ellers den
    // billigste, og ved samme pris den laveste id, saa to koersler paa samme
    // feed giver samme resultat.
    const a = nuvaerende.vare;
    const aGemt = gemte.has(a.id);
    const vGemt = gemte.has(v.id);
    if (aGemt !== vGemt) {
      if (vGemt) modeller.set(noegle, { kategori: kat, vare: v });
      continue;
    }
    if (v.price < a.price || (v.price === a.price && v.id < a.id)) {
      modeller.set(noegle, { kategori: kat, vare: v });
    }
  }

  // 3: loft pr. kategori, med de gemte foerst.
  const pulje = new Map<string, T[]>();
  for (const { kategori, vare } of modeller.values()) {
    const liste = pulje.get(kategori) ?? [];
    liste.push(vare);
    pulje.set(kategori, liste);
  }

  const valgte: T[] = [];
  const prKategori = new Map<string, number>();
  for (const [kategori, liste] of [...pulje].sort(([a], [b]) => a.localeCompare(b))) {
    // Loftet er pr. kategori, saa de kategorier flere guider deler kan have et
    // hoejere ét. Se loftPrKategoriOverstyring i lib/affiliate-feeds.ts.
    //
    // maksPrBrand er hoejst saa mange modeller fra samme maerke i samme
    // kategori. Uden den graense var tolv af atten vandrebukser Fjällräven:
    // feedet har ti forskellige zip-off-modeller fra dem alene, saa
    // fordelingen paa brands raekker ikke. En guide, der kun kan sammenligne
    // ét maerke, er ikke en sammenligning.
    //
    // Den foelger kategoriens loft og ikke feedets, ellers ville et loft paa
    // 45 kunne blive ni af samme maerke gange fem. Den kan ogsaa overstyres
    // helt, fordi et specialiseret feed kan vaere forhandler for ét maerke.
    const katLoft = loftOverstyring?.[kategori] ?? loft;
    const maksPrBrand = maksPrBrandOverstyret ?? Math.max(2, Math.ceil(katLoft / 5));
    const beholdes = liste.filter((v) => gemte.has(v.id));
    const nye = liste.filter((v) => !gemte.has(v.id));
    const plads = Math.max(0, katLoft - beholdes.length);

    // Brand-graensen taeller de gemte med, saa ét maerke ikke hober sig op
    // dag for dag. De gemte bliver aldrig skubbet ud af den.
    const brugt = new Map<string, number>();
    for (const v of beholdes) {
      const b = brandNoegle(v);
      brugt.set(b, (brugt.get(b) ?? 0) + 1);
    }
    const tilfoejes: T[] = [];
    for (const v of fordelPaaBrands(nye)) {
      if (tilfoejes.length >= plads) break;
      const b = brandNoegle(v);
      const n = brugt.get(b) ?? 0;
      if (n >= maksPrBrand) continue;
      brugt.set(b, n + 1);
      tilfoejes.push(v);
    }
    const ialt = [...beholdes, ...tilfoejes];
    valgte.push(...ialt);
    prKategori.set(kategori, ialt.length);
  }
  return { valgte, prKategori };
}

/**
 * Sorterer varer saa loftet rammer flere brands frem for ét.
 *
 * Uden dette er de 20 fleecetroejer vi gemmer sorteret som feedet, og feedet
 * er sorteret pr. brand: alle 20 blev The North Face, og en guide, der kun kan
 * sammenligne ét maerke, er ikke en sammenligning. Her tages én vare pr. brand
 * pr. runde. Brands sorteres efter navn og varer efter id, saa raekkefoelgen er
 * den samme hver gang det samme feed koeres.
 */
function fordelPaaBrands<T extends UdvalgVare>(varer: T[]): T[] {
  const pr = new Map<string, T[]>();
  for (const v of varer) {
    const b = brandNoegle(v);
    const liste = pr.get(b) ?? [];
    liste.push(v);
    pr.set(b, liste);
  }
  const brands = [...pr.keys()].sort();
  for (const b of brands) pr.get(b)!.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const ud: T[] = [];
  for (let runde = 0; ud.length < varer.length; runde++) {
    let tilfoejet = false;
    for (const b of brands) {
      const liste = pr.get(b)!;
      if (runde < liste.length) {
        ud.push(liste[runde]);
        tilfoejet = true;
      }
    }
    if (!tilfoejet) break; // sikkerhedsnet: ingen uendelig loekke paa tom liste
  }
  return ud;
}
