/**
 * Hvilke tilbud der hoerer paa en koebsguide, og hvilke der ikke goer.
 *
 * Tilbudsblokken slog op i den hyppigste `category_mapped` blandt guidens egne
 * entries. For flere guider er den en bred foraelderkategori, og saa viste
 * blokken noget andet end emnet. Maalt live 26. oktober 2026, 12 af de 28
 * guider med en blok:
 *
 *   handsker, hue, gamacher, uldundertoj  [beklaedning] -> Bicycle Repair Kit
 *   oekse                                 [kniv]        -> proptraekker x2
 *   kompas                                [prepping]    -> noedpakke x3
 *   taendstaal                            [kogeudstyr]  -> madkasse-saet
 *   dry-bag                               [taske]       -> boernemadkasse
 *   vandrerygsaek                         [rygsaek]     -> gaarem til smaaboern
 *   kikkert                               [kikkert]     -> riffelmontager
 *   vandfilter                            [vandfilter]  -> udskiftningspatron
 *   lanterne                              [pandelampe]  -> pandelamper x3
 *
 * De tre sidste viser, at kategorien ikke er hele problemet: en kategori kan
 * vaere rigtig og varen stadig vaere tilbehoer, og to snaevre kategorier kan
 * vaere naboer uden at vaere det samme.
 *
 * FOERSTE UDGAVE matchede guidens slug mod produktnavnet. Den blev proevet mod
 * de 182 historiske klik paa fladen og fjernede 10 % af dem, heraf de tre
 * stoerste poster: "Sea To Summit Air Chair - Stol" paa campingstol (5 klik,
 * fordi slug'en ikke staar i navnet), "Rygsaek til kvinde - Tatonka" paa
 * vandrerygsaek (5) og "Gaiters - Black Diamond" paa gamacher (4, fordi navnet
 * er engelsk og slug'en dansk). Et dansk sammensat slug er simpelthen ikke et
 * godt filter mod engelske produktnavne.
 *
 * Vokabularet kommer derfor fra guidens EGNE entries. De er haandplukkede og
 * rigtige, saa de beskriver praecis hvad en relevant vare hedder paa denne
 * side, i det sprog forhandleren bruger.
 *
 * `getTopDeals` havde ingen af de to vaern, guidens entries gaar igennem. De
 * genbruges her frem for at skrives igen: `ALDRIG` fra feed-filteret og
 * stoerrelses- og farvevokabularet fra udvalget.
 */
import { ALDRIG, guidenHandlerOmBoern } from "./feed-kategori-filter";
import { ENGROS } from "./kategori-fra-navn";
import { FARVE, STOERRELSE } from "./feed-udvalg";

/**
 * Tilbehoer og reservedele.
 *
 * Kikkert-kategorien er 21 % tilbehoer (177 af 836: stativadaptere, linserens,
 * riffelmontager, telefonadaptere), og vandfilter-blokken viste en
 * udskiftningspatron. Begge laa i den rigtige kategori, saa kategorien kan
 * ikke fange dem, og entry-vokabularet kan heller ikke: en patron hedder ogsaa
 * "Vandfilter".
 *
 * "filter" staar med vilje IKKE her: et vandfilter er en vare. Patronen fanges
 * paa "replacement".
 */
const TILBEHOER =
  /tilbeh[øo]r|montage|montager|montering|adapter|stativ|tripod|okular|objektiv|udskiftning|reservedel|replacement|spare\s+part|refill|genopfyld|hand\s+control|fjernbetjening|rense?(?:middel|sæt|saet|kit)|cleaning\s+kit|opladerkabel|holder\s+til|cover\s+til|etui\s+til|pose\s+til|taske\s+til/i;

/** Mindste laengde for at et ord kan baere relevans. */
const MIN_ORD = 4;

/**
 * Mindste laengde for at et PRAEFIKS maa taelle som match.
 *
 * Danske flertals- og bestemte former kraever praefiks-match: en entry der
 * hedder "Kikkert" skal matche et tilbud der hedder "kikkerter". Men "camp"
 * maa ikke matche "camping", for saa slap "Gentlemen's Hardware Camping Pot"
 * ind paa bestik-guiden, hvis entries indeholder "Camp Cutlery". Seks tegn
 * skiller de to.
 */
const MIN_PRAEFIKS = 6;

/**
 * Mindste laengde for at et SUFFIKS maa taelle som match.
 *
 * Danske sammensatte ord saetter hovedordet sidst: campingstol, foldestol,
 * festivalstol, positionsstol, stormlanterne, vandrerygsaek. Praefiks-match
 * leder derfor den forkerte vej, og det kostede dyrt: foerste udgave fjernede
 * 19 af de 182 maalte klik, og alle 19 var Outwell-stole der hedder
 * "- Campingstol", paa en guide hvis kendeord er "stol".
 *
 * Fire tegn, fordi hovedordene ER korte: stol, telt, sav, hue. Det er sikkert
 * nok, fordi et suffiks er en meget snaevrere relation end et praefiks:
 * "camp" er praefiks i "camping", men ikke suffiks.
 */
const MIN_SUFFIKS = 4;

/**
 * Navnet med bogstaver og tal, uden diakritiske tegn og skilletegn.
 *
 * Begge sider foldes ens, for navnene er ikke konsekvente: "Rygsæk", "rygsaek"
 * og "Rygsak" skal vaere samme ord.
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "a")
    .replace(/å/g, "a")
    .replace(/oe/g, "o")
    .replace(/ae/g, "a")
    .replace(/aa/g, "a")
    .replace(/[^a-z0-9]/g, "");
}

/** Varen er tilbehoer til en vare frem for varen selv. */
export function erTilbehoer(navn: string): boolean {
  return TILBEHOER.test(navn);
}

/**
 * Modelnavnet uden en afsluttende stoerrelse eller farve, saa to varianter af
 * samme vare taelles som én.
 *
 * `basisNavn` i feed-udvalg loeser den samme opgave for importen, men den er
 * forankret paa komma og bindestreg, fordi det er saadan de filtrerede feeds
 * skriver varianter. Tilbudsblokken henter fra hele kataloget, hvor Outmore
 * skriver dem med mellemrum: "Pinewood Tiveden Sweater Fleece W Black S" og
 * "... Black M". `basisNavn` giver dem uaendret tilbage, saa to af tre tilbud
 * paa fleece-guiden var den samme troeje. Her skaeres derfor paa det sidste
 * ord, med det samme vokabular.
 */
export function varianthoved(navn: string): string {
  let s = navn.trim();
  for (let i = 0; i < 3; i++) {
    const m = s.match(/\s+([^\s]+)$/);
    if (!m || m.index == null) break;
    const sidste = m[1];
    // FARVE har ordgraenser, saa den skal proeves paa ordet alene.
    if (!STOERRELSE.test(sidste) && !FARVE.test(sidste)) break;
    s = s.slice(0, m.index).trim();
  }
  return s;
}

/**
 * De ord i et navn der kan baere relevans.
 *
 * Maerket udelades. Ellers ville ethvert Sea to Summit-produkt passe paa
 * bestik-guiden, fordi en af dens entries er "Sea to Summit Camp Cutlery Set",
 * og saa var vokabularet et maerkefilter frem for et emnefilter.
 */
export function emneOrd(navn: string, maerker: Iterable<string>): Set<string> {
  const udeluk = new Set<string>();
  for (const m of maerker) {
    for (const d of m.split(/[\s/&-]+/)) {
      const f = fold(d);
      if (f) udeluk.add(f);
    }
  }
  const ud = new Set<string>();
  for (const ord of navn.split(/[\s,/&|()[\]-]+/)) {
    const f = fold(ord);
    if (f.length < MIN_ORD || udeluk.has(f) || /^\d+$/.test(f)) continue;
    // En farve eller en stoerrelse er aldrig et emne. Uden dette kunne "sort"
    // blive kendeord for en guide med mange sorte varer, og suffiks-reglen
    // ville saa matche "resort".
    if (FARVE.test(ord) || STOERRELSE.test(ord)) continue;
    ud.add(f);
  }
  return ud;
}

/**
 * De ord der KENDETEGNER guiden, frem for alle ord i dens produktnavne.
 *
 * Alle ord var for bredt. Lanterne-guiden har én entry der hedder "Lanterne -
 * Black Diamond Moji R+ - Genopladelig", og ordet "genopladelig" lukkede
 * dermed tre pandelamper ind. Oekse-guiden har en entry med "Multitool" i
 * navnet, og saa kom proptraekkeren tilbage.
 *
 * Et emneord optraeder i flere af guidens entries; et tilfaeldigt ord staar i
 * én. Maalt paa guiderne: "rygsak" staar i 7 af 7, "gaiters" i 5 af 7,
 * "lanterne" i 5 af 7, "stol" og "chair" i 4 af 7. Mens "genopladelig",
 * "multitool", "kopholdere" og "foldbar" staar i én hver.
 *
 * Taersklen er dataafhaengig frem for en haandholdt stopordsliste, saa den
 * ikke skal vedligeholdes, naar en ny guide kommer til.
 */
export function kendeOrd(navne: string[], maerker: Iterable<string>): Set<string> {
  const antal = new Map<string, number>();
  for (const n of navne) {
    for (const o of emneOrd(n, maerker)) antal.set(o, (antal.get(o) ?? 0) + 1);
  }
  const taerskel = Math.max(2, Math.ceil(navne.length / 3));
  const ud = new Set<string>();
  for (const [o, n] of antal) if (n >= taerskel) ud.add(o);
  return ud;
}

/**
 * Deler de to ordmaengder et emneord?
 *
 * Tre slags match, og laengdekravet er forskelligt, fordi relationerne er
 * forskelligt snaevre. Se MIN_PRAEFIKS og MIN_SUFFIKS.
 */
export function delerEmneord(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    if (b.has(x)) return true;
    for (const y of b) {
      const [kort, lang] = x.length <= y.length ? [x, y] : [y, x];
      if (kort.length >= MIN_SUFFIKS && lang.endsWith(kort)) return true;
      if (kort.length >= MIN_PRAEFIKS && lang.startsWith(kort)) return true;
    }
  }
  return false;
}

/**
 * Hoerer kategorien til guidens eget emne?
 *
 * Sandt naar slug'en ER kategorien, eller indeholder den: `letvaegtstelt` og
 * `familietelt` hoerer til `telt`, og `liggeunderlag-til-vinter` til
 * `liggeunderlag`. Falsk for `lanterne` mod `pandelampe`, som er naboer og ikke
 * det samme, og for `oekse` mod `kniv`.
 *
 * Naar den er sand, raekker kategorien som relevansbevis, og entry-ordene
 * behoever ikke svare. Det er det, der holder "Helly Hansen Imperial Long Pile
 * Jacket" paa fleece-guiden: en fleece der ikke hedder fleece.
 */
export function kategoriErEget(guideSlug: string, kategori: string): boolean {
  const g = fold(guideSlug);
  const k = fold(kategori);
  return !!k && (g === k || g.includes(k));
}

/**
 * Noeglen to varianter af samme vare skal dele.
 *
 * `varianthoved` skaerer bagfra, og det raekker ikke, naar varianten staar
 * midt i navnet: Outmore skriver "Knog Bilby Run 400 Coral - Pandelampe" og
 * "... Lime - Pandelampe", hvor kategorien staar sidst. Derfor fjernes farve-
 * og stoerrelsesord uanset hvor de staar.
 *
 * Det er mere aggressivt end `basisNavn` i importen tillader sig, og det er
 * bevidst: noeglen bruges KUN til at skelne de hoejst tre tilbud paa én guide,
 * og den vises aldrig. Slaar to forskellige modeller fejlagtigt sammen, viser
 * blokken to tilbud i stedet for tre. Det omvendte, samme vare to gange, ser
 * ud som en fejl.
 */
export function dubletNoegle(navn: string): string {
  const ord = varianthoved(navn)
    .split(/[\s,/&|()[\]-]+/)
    .filter((o) => o && !FARVE.test(o) && !STOERRELSE.test(o));
  return fold(ord.join(""));
}

export interface TilbudsVare {
  id: string;
  brand: string | null;
  product_name: string;
  category_mapped: string | null;
}

export interface GuideKontekst {
  slug: string;
  /** Kategorien tilbuddene blev hentet fra. */
  kategori: string;
  /** Produktnavnene paa guidens egne entries. */
  entryNavne: string[];
  /** Maerkerne paa guidens egne entries, saa de ikke bliver emneord. */
  entryMaerker: string[];
}

/**
 * Tilbuddene der hoerer paa guiden, i samme raekkefoelge som de kom ind.
 *
 * Returnerer gerne en tom liste. Blokken skriver "Aktuelle nedsaettelser i
 * samme kategori", og paa `oekse` og `solhat` er der nul varer i kataloget, der
 * kvalificerer. Ingen blok er det rigtige svar der; en proptraekker er det
 * ikke.
 */
export function relevanteTilbud<T extends TilbudsVare>(
  varer: T[],
  guide: GuideKontekst
): T[] {
  const eget = kategoriErEget(guide.slug, guide.kategori);

  // Boerneudstyr udelukkes, MEDMINDRE guiden selv handler om det:
  // /bedste/sovepose-til-boern har "Boernesovepose" i navnene, og uden den
  // undtagelse fjernede filteret de varer, guiden handler om (3 af de 182
  // maalte klik). Reglen staar i feed-kategori-filter, fordi sundhedstjekket
  // skal svare det samme.
  const guidenErTilBoern = guidenHandlerOmBoern(guide.slug, guide.entryNavne);

  const emne = kendeOrd(guide.entryNavne, guide.entryMaerker);

  const ud: T[] = [];
  const set = new Set<string>();
  for (const v of varer) {
    const navn = v.product_name ?? "";
    if (!guidenErTilBoern && (ALDRIG.test(navn) || ALDRIG.test(v.category_mapped ?? ""))) continue;
    if (erTilbehoer(navn)) continue;
    // Engros og gavesaet, uanset hvordan varen fik sin kategori. Vaernet staar
    // HER og ikke kun i kategoriseringen, fordi en vare kan faa sin kategori
    // fra den manuelle kortlaegning uden at gaa gennem navnereglerne:
    // outmore::Handsker er kortlagt til handsker og rummer fire Park
    // Tool-aesker med 100 gummihandsker.
    if (ENGROS.test(navn)) continue;
    // Kategorien er guidens eget emne, eller varen skal hedde noget af det
    // samme som guidens egne produkter.
    if (!eget && !delerEmneord(emneOrd(navn, guide.entryMaerker), emne)) continue;

    const noegle = `${(v.brand ?? "").trim().toLowerCase()}|${dubletNoegle(navn)}`;
    if (set.has(noegle)) continue;
    set.add(noegle);
    ud.push(v);
  }
  return ud;
}
