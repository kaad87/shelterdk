/**
 * Hvad vi importerer fra de store feeds, og hvad vi lader ligge.
 *
 * Pro Outdoor har 49.556 varer og Outdoornu 32.611. Vi bruger 6-8 produkter
 * pr. guide. At gemme 82.000 raekker for at bruge et par hundrede ville
 * sekstendoble en tabel, hvor 98 % allerede er ubrugt, og egress hos Supabase
 * er i forvejen et problem.
 *
 * Derfor importeres KUN varer der matcher en kategori herunder. Feedets eget
 * `kategorinavn` duer ikke alene: det er fuldt af "Brands > Patagonia >
 * Patagonia Fleece" og "Fiskegrej > Endegrej > Blink". Der matches derfor paa
 * produktnavn OG kategorinavn, med en udelukkelse der fjerner det der ligner,
 * men ikke er: en fleecehandske er ikke en fleecetroeje.
 *
 * Tallene i kommentarerne er modeller paa lager med beskrivelse, maalt paa de
 * cachede feeds. De er grunden til at netop disse kategorier er med.
 */

export interface FeedKategori {
  /** ShelterDK-kategorien varen havner i. */
  kategori: string;
  inkluder: RegExp;
  udeluk: RegExp;
  /** Hoejeste pris vi tager med. Udeladt = ingen graense. */
  maksPris?: number;
}

/**
 * Udelukkes uanset kategori.
 *
 * Boernetoej og hundeudstyr er ikke forkert i sig selv, men guiderne her er
 * til voksne paa sheltertur, og en boernefleece i en voksenguide er en
 * stoerrelse ingen kan bruge. Reglen staar ét sted frem for gentaget i hver
 * kategori: foerste udgave havde "baby" i fleece-reglen men ikke "boerne", og
 * "Boerne fleecetroeje" slap igennem.
 */
const ALDRIG =
  // "hund" uden ordgraense fangede ikke "Hundesandal", hvor ordet loeber
  // videre. Uden (?!rede) ville det til gengaeld ramme "hundrede".
  //
  // De engelske ord er ikke pynt: feedenes produktnavne er engelske, og
  // "Teen Reversible North Down Jacket" slap igennem en liste med kun danske
  // ord. Proeves mod navn OG kategorinavn, saa en vare i kategorigrenen
  // "Brands > The North Face > Boern" ogsaa falder, selv om navnet er neutralt.
  /\bhund(?!rede)[a-zæøå]*|\bbørn|\bjunior\b|\bbaby\b|\bbarn\b|\bkids\b|\bteen|\byouth\b|\bboys?\b|\bgirls?\b|\btoddler\b/i;

export const FEED_KATEGORIER: FeedKategori[] = [
  // Hed "lejrsko", indtil udvalget blev laest igennem: varerne er
  // vandresandaler og hybridsko (Keen Arroyo, Salomon Techamphibian, CMP Abid
  // Hiking Sandal), altsaa fodtoej man GAAR i. Der var tre rene lejrsko i alt,
  // ikke nok til en guide. Kategorien hedder nu det, varerne er, og lejr-brugen
  // er et afsnit i guiden frem for dens titel.
  { kategori: "vandresandal",
    inkluder: /sandal|\bcrocs\b|badesko|\bclog|flip.?flop/i,
    // "NOU Emilian W Leather Cork Moc" beskriver sig selv som damesutsko.
    udeluk: /\bsok|\bsock|strømpe|indlægssål|insole|sutsko|hjemmesko|slipper|\bmoc\b/i },
  // Mellemlaget mangler helt; uldundertoej daekker baselaget.
  { kategori: "fleece",
    inkluder: /\bfleece/i,
    // De fire sidste grene er fundet ved at laese hvad filteret faktisk valgte:
    // en soveposeliner, en jogger, en Stetson-hue og en vest kom med, fordi
    // feedkategorien hedder fleece. Hoodie-grenen slaar kun til naar ordet
    // "fleece" ikke selv staar i navnet, saa en rigtig fleecehoodie bliver
    // tilbage, mens en bomuldshaettetroeje ryger.
    udeluk: /handske|vante|hue\b|\bsok|tæppe|plaid|halsedisse|liner\b|sleeping|jogger|\bpants?\b|buks|trousers?|waistcoat|knitted|strik|\bvest\b|shearling|\bcap\b|beanie|\bdragt\b|\bsuit\b|waders?\b|headband|pandebånd|docker|gaiter|midlayer|cardigan|^(?!.*fleece)(?=.*\b(hoodie|hættetrøje|sweatshirt|pullover|crewneck)\b)/i },
  // Det man tager paa naar man sidder stille ved baalet. Dunveste hoerer her
  // og ikke i en egen vestkategori: se kommentaren nederst i filen.
  { kategori: "dunjakke",
    inkluder: /\bdun(jakke|vest|frakke)|down (jacket|vest)|primaloft|isolerings?jakke/i,
    // "primaloft" alene trak Hestras handsker og luffer med ind.
    // "Hestra CZone Primaloft Flex - 5 Finger" har intet handskeord i navnet,
    // kun fingrene. Det er den slags man kun finder ved at laese udvalget.
    // Bomuldsyderstof, parka og lang frakke er byjakker. De kom med, fordi de
    // ER dunjakker, men en "Cotton Down Parka" er ikke sheltergrej.
    udeluk: /sovepose|pude|dyne|handske|vante|\bmitt|glove|finger|hætte\b|\bcoat\b|parka|cotton/i,
    // En dunjakke til 13.049 kr (Canada Goose Langford Parka) er ikke et
    // shelterprodukt. Loftet er ikke en smagsdom over jakken, men over hvad
    // der hoerer i en guide til folk der sover i shelter.
    maksPris: 4000 },
  // Laget man faktisk gaar i. Regntoej daekker kun regnbukser, og "zip-off"
  // er et usedvanligt praecist signal i begge feeds.
  { kategori: "vandrebukser",
    inkluder: /vandrebuks|trekkingbuks|zip-?off|outdoorbuks|hiking pant|trekking pant|convertible pant/i,
    udeluk: /undertøj|under-?buks/i },
  // Vi har hue til kulde, intet til sol. Bevidst snaever: en trucker cap er
  // ikke solbeskyttelse, og en guide der blander dem er ikke en guide.
  { kategori: "solhat",
    // UPF staar paa alt solbeskyttende toej, ikke bare hovedbeklaedning: med
    // \bupf\b alene kom en Westin-hoodie, en halvfingerhandske og en
    // halsedisse med som solhatte. Derfor skal der staa et hoved-ord ogsaa.
    // Og \bupf\b fangede ikke "UPF40+", hvor tallet loeber videre i ordet.
    inkluder: /solhat|bøllehat|sun.?hat|bucket.?hat|brimmer|booney|wide.?brim|safari.?hat|legionær|\b(hat|cap|kasket)\b.*\bupf|\bupf.*\b(hat|cap|kasket)\b/i,
    udeluk: /\bhue\b|beanie|\bsok|shirt|jakke|jacket|buks|pant|hoodie|glove|handske|gaiter|halsedisse/i },
];

/**
 * Ingen vestkategori.
 *
 * "isoleringsvest" var med i foerste udgave med 229 maalte modeller, og den
 * blev taget ud efter at varerne blev laest igennem: \bvest\b er for svagt et
 * signal. Udvalget indeholdt et Calazo-landkort ("Kyst til Kyst Vest"),
 * jagtveste, loebeveste, to varmeveste med batteri og en hundesportsvest.
 * Dunveste fanges af dunjakke-reglen, og resten er ikke vores.
 */

/**
 * Den ShelterDK-kategori en vare hoerer til, eller null hvis den skal lades
 * ligge. Foerste match vinder, saa raekkefoelgen ovenfor er betydende:
 * en dunvest skal vaere dunjakke og ikke isoleringsvest.
 */
export function kategoriFor(produktnavn: string, kategorinavn: string | null): string | null {
  const navn = produktnavn || "";
  const blob = `${navn} ${kategorinavn ?? ""}`;
  if (ALDRIG.test(blob)) return null;
  for (const k of FEED_KATEGORIER) {
    if (k.inkluder.test(blob) && !k.udeluk.test(navn)) return k.kategori;
  }
  return null;
}

/**
 * Er prisen inden for kategoriens graense?
 *
 * Staar for sig frem for inde i kategoriFor(), saa den rene navne-til-kategori
 * funktion stadig kan testes uden en pris, og saa udvalgskoden ikke behoever
 * kende til priser for de kategorier der ikke har en graense.
 */
export function prisOk(kategori: string, pris: number): boolean {
  const k = FEED_KATEGORIER.find((x) => x.kategori === kategori);
  return k?.maksPris == null || pris <= k.maksPris;
}
