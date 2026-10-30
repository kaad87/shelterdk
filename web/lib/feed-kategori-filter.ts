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
  /**
   * Proev kun `inkluder` mod produktnavnet, ikke mod feedets kategorinavn.
   *
   * Toejkategorierne har brug for kategorinavnet, fordi de to store feeds har
   * engelske produktnavne og danske kategoritraeer: "Teva Terra Fi Lite Herre"
   * siger ikke sandal. Vaerktoej er det modsatte. Hos Outdoor I Centrum ligger
   * knive og oekser i samme gren, saa kategorien trak tolv varer med ind i
   * oekse-kategorien, hvoraf ni var knive, macheter og et multitool-saet.
   */
  kunNavn?: boolean;
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
export const ALDRIG =
  // "hund" uden ordgraense fangede ikke "Hundesandal", hvor ordet loeber
  // videre. Uden (?!rede) ville det til gengaeld ramme "hundrede".
  //
  // De engelske ord er ikke pynt: feedenes produktnavne er engelske, og
  // "Teen Reversible North Down Jacket" slap igennem en liste med kun danske
  // ord. Proeves mod navn OG kategorinavn, saa en vare i kategorigrenen
  // "Brands > The North Face > Boern" ogsaa falder, selv om navnet er neutralt.
  //
  // "barn" skal IKKE ramme "Barn Red", som er en farve. Maalt paa kataloget
  // matcher \bbarn\b praecis to af 17.220 raekker, og begge er "Primus
  // Ignition Steel ... Barn Red - Taendstaal". Ordet fangede altsaa nul
  // boerneprodukter og to farver.
  /\bhund(?!rede)[a-zæøå]*|\bbørn|\bjunior\b|\bbaby\b|\bbarn\b(?!\s+red\b)|\bkids\b|\bteen|\byouth\b|\bboys?\b|\bgirls?\b|\btoddler\b/i;

/**
 * Handler guiden selv om boern?
 *
 * Bruges to steder med samme svar: sundhedstjekket skal ikke melde
 * boernesoveposer paa /bedste/sovepose-til-boern, og tilbudsblokken skal ikke
 * filtrere dem vaek der.
 *
 * FLERTALLET af navnene skal vaere boernevarer. Foerste udgave i
 * deal-relevans spurgte om NOGEN af dem var, og det var for lidt: /bedste/regntoj
 * har én bevidst boerne-poncho ud af syv entries, saa vaernet var slukket for
 * hele guiden, og "Reisenthel Mini Maxi Poncho M Kids Abc Friends Blue" kom
 * med i tilbudsblokken.
 */
export function guidenHandlerOmBoern(slug: string, entryNavne: string[]): boolean {
  if (ALDRIG.test(slug)) return true;
  if (!entryNavne.length) return false;
  return entryNavne.filter((n) => ALDRIG.test(n)).length > entryNavne.length / 2;
}

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
  // Kikkert. Fire varer med brugbar tekst i det eksisterende katalog er for
  // lidt til en guide, og Zeejuu er et optik-feed med beskrivelser paa alt.
  { kategori: "kikkert",
    kunNavn: true,
    inkluder: /\bkikkert|binocular|monokular|spotting ?scope/i,
    // Stativ, taske og pudseklud er tilbehoer, ikke en kikkert. Og natkigger
    // og termisk optik hoerer til jagt i moerke, ikke til en sheltertur.
    udeluk: /stativ|tripod|taske|etui|pudse|rem\b|adapter|okular|natkig|termisk|thermal|night ?vision|riffel|sigtekikkert/i },
  // Oekse og sav. Syv varer med tekst i kataloget, alle fra samme forhandler.
  { kategori: "oekse",
    kunNavn: true,
    // \bsaw\b er ikke pynt: de to smaa feeds bruger engelske produktnavne, og
    // "Gerber Freescape Camp Saw" matcher ikke det danske \bsav\b.
    // Uden \b foran "økse". JavaScripts \b er ASCII-baseret, saa der ER ingen
    // ordgraense foer et "ø": /\bøkse/ matchede aldrig "Økse - Survival".
    // Python er unicode-bevidst, og det var derfor en tidligere optaelling i
    // Python fandt syv oekser, som filteret ikke kunne se.
    inkluder: /økse|brændekløver|kløvejern|\bsav\b|\bsaw\b|buesav|foldesav|grensav|handsav|hatchet|\baxe\b/i,
    // Motorsav og kædesav er ikke til baalet. Skaft og skede er tilbehoer.
    // En "Pick axe" er en hakke til at grave med, ikke en braendeoekse.
    udeluk: /motorsav|kædesav|rundsav|stiksav|bajonetsav|klinge\b|\bskaft\b|skede|slibe|fil\b|brænde?stativ|pick ?axe|hakke\b|spids?hakke/i },
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
 * Feeds med deres egen flade kategoriliste.
 *
 * Pro Outdoor og Outdoornu skriver kategorien som en gren i et traee fyldt
 * med maerkenavne ("Brands > Patagonia > Patagonia Fleece"), og derfor maa de
 * regnes ud af produktnavnet. Outnorth gaer ikke: feedet har 228 flade,
 * danske kategorinavne, hvor "Tunneltelte", "Dunsoveposer" og "Pandelamper"
 * betyder praecis det, de siger.
 *
 * Reglerne ovenfor var bygget til det modsatte problem og rammer kun 5 % af
 * Outnorths 97.197 varer, fordi de blev skrevet for at lukke et hul i toej og
 * fodtoej. Outnorths vaerdi er grejet. Et opslag er baade mere praecist og
 * nemmere at laese end tyve regex-regler mere.
 *
 * Et opslag springer IKKE udelukkelsen over: rammer kategorien en regel
 * ovenfor, skal varen stadig igennem dens `udeluk` og dens `maksPris`. Ellers
 * ville "Cotton Down Parka" i grenen "Dunjakker" komme ind som dunjakke, selv
 * om regelen ovenfor har brugt tre linjer paa at holde byjakker ude.
 *
 * Kategorier, der bevidst IKKE staar her: Loebesko, alt med ski, Hverdagssko,
 * Badetoej, Jagt*, Agn, Litteratur og Hundedaekkener er ikke sheltergrej.
 * Batterier, Teltilbehoer, Rygsaekstilbehoer og Skotilbehoer er tilbehoer og
 * er praecis den stoej, fase 2 brugte en uge paa at faa ud af /tilbud.
 * Mellemlag og Syntetjakker blandes af fleece og syntetisk fyld i samme gren,
 * saa de overlades til fleece-reglen ovenfor, der kan se forskel paa navnet.
 */
/**
 * Tilbehoer og reservedele i et opslag.
 *
 * Et fladt kategorinavn siger, hvad hylden hedder, ikke om varen er sagen
 * selv. Outnorth laegger stavspidser under Vandrestave, filterpatroner under
 * Vandrensning, et skedehylster under Multivaerktoej og ladekabler under
 * Powerbanker. Maalt paa de 20 foerste i hver kategori var 6 af 20 vandrestave
 * spidser og kurve, og 7 af 20 vandfiltre var reservedele.
 *
 * Det er den samme stoej, fase 2 skar ud af /tilbud. Den staar ét sted frem
 * for i hver kategori, fordi det er feedets maade at skrive paa og ikke en
 * egenskab ved den enkelte kategori.
 *
 * "kit" alene maa IKKE staa her: "First Aid Kit" er selve varen i
 * foerstehjaelp. Derfor kun de sammensatte former.
 */
const TILBEHOER_OPSLAG =
  /\bspare\b|\breplacement\b|\brefill\b|\bcartridges?\b|\b(?:maintenance|maintance|care|repair|cleaning)\s+kit\b|\btips?\b|\bbaskets?\b|\bsheath\b|\badapter\b|\bcables?\b|\bcharg(?:er|ing)\b|\bstabilizer\b|\bwick\b/i;

/**
 * Det en kategori selv skal holde ude, naar den kommer fra et opslag.
 *
 * Noeglen er ShelterDK-kategorien og ikke feedets kategorinavn, fordi flere
 * af feedets grene lander samme sted: Lygter, Lommelygter og Andre lamper
 * bliver alle til lygte, og de har den samme slags stoej.
 *
 * Kategorier, der ogsaa har en regel i FEED_KATEGORIER, staar ikke her. De
 * arver reglens `udeluk`, som allerede er laest igennem og testet.
 */
const OPSLAG_UDELUK: Record<string, RegExp> = {
  // Grenen "Haengekoejer" er halvt ophaeng: stropper, karabiner, en
  // ridgeline-organizer og et par myggenet uden koeje.
  haengekoje: /suspension|\bstraps?\b|webbing|carabiner|karabin|\borganizer\b|hanging kit|\brope\b|\bpouch\b|bugnet|\bstand\b|\btarp\b|underquilt/i,
  // "Puder" er Outnorths rejsehylde saa meget som lejrhylden: nakkepuder og
  // memory foam hoerer i en flyvemaskine, ikke i en sovepose.
  soveudstyr: /\bneck\b|\btravel\b|memory\s*(?:foam|dreamer|zzz)|car\s*camp|cabeau/i,
  // "Tarp & Shelters" rummer ogsaa bivyposer, strandly, en pavillon og et
  // isoleret 9-personers telt til 8.951 kr.
  tarp: /\bbiv(?:y|i|vy)\b|bivybag|\bbeach\b|vestibule|\bsauna\b|\btents?\b|\btelt\b|wind sack|jaktduk|onepush|gazebo|air shelter|survival shelter|\bbothy\b|skogskoja|\bglamp\b|fjellduk/i,
  // Outnorth laegger vandfiltre og braendstofflasker under "Flasker".
  drikkedunk: /\bfilter\b|lifestraw|miniworks|\bgravity\b|purif|fuel bottle|\bwine\b|carafe|\bmugs?\b|\blunch\b/i,
  // Lygtegrenen er ogsaa reflekser, knaeklys og en hundelygte.
  lygte: /\bglow\b|ljusstav|reflective|refleks|\bbeacon\b|work light|\bbelt\b|\blighter\b|\bbatter(?:y|i)/i,
  // "Pakposer og organizere" har mulepose og en lugtfjerner med.
  taske: /tote|freshener|smell|\btube\b|toiletry/i,
  // "Toiletartikler" er haandklaeder plus creme, saebe og badeponchoer.
  hygiejne: /\bponcho\b|\byoga\b|\bbottles?\b|squeezy|chamois|body\s?glide|\bcr[eè]mes?\b|\bsoap\b|shampoo|gogirl/i,
  // Slibesten, hylstre og "plus accessories" staar hos knivene.
  kniv: /sharpen|slibe|\bbryne|whetstone|accessories/i,
  // Airtrim er naesefiltre til cykling, og "filter cap" er et laag.
  vandfilter: /\bfilter cap\b|airtrim|racingfilter|sportfilter|filterel/i,
  // Spidser og kurve er fanget ovenfor; her er handsker og trugerstave.
  vandrestav: /\bgloves?\b|handske|snowshoe|truger/i,
  // "Wallcharger" i ét ord slipper forbi \bcharger\b ovenfor.
  elektronik: /wallcharger/i,
  // "Insektbeskyttelse" er to ting i samme gren. Godt halvdelen er rigtige
  // net, resten er spray, roll-on, gel, myggelys og ultralydsdimser. Vi vil
  // kun have nettene: en guide til myggenet, der anbefaler DEET, er ikke en
  // guide til myggenet.
  //
  // "ljus" uden ordgraense foran: myggelyset heder "Myggljus/Sommarljus", saa
  // \bljus\b ramte det ikke.
  myggenet: /spray|roll.?on|\bstick\b|\bgel\b|after bite|\bdeet\b|tickless|moskitofree|ljus\b|fästing|anti.?insect/i,
  // Varmepuder og vaerktoejsruller er ikke kogegrej.
  kogeudstyr: /heat pack|flameless|tool roll/i,
  // Kasser og tasker staar under moeblerne.
  campingmobler: /gear\s*(?:basket|tote|box)/i,
};

/**
 * Naar feedets gren er grovere end vores kategori.
 *
 * Outnorth har ingen siddeunderlags-gren: Woolpower Sit Pad, Exped Sit Pad,
 * Fjällräven G1000 Seat Pad, Sea To Summit Air Seat, Klymit V-seat og
 * iFish Heat-seat ligger alle under "Campingmoebler" sammen med stole og
 * borde. Syv af de tyve varer, loftet lukkede ind, var siddeunderlag, og
 * /bedste/siddeunderlag havde samtidig kun 16 varer at vaelge imellem i hele
 * kataloget.
 *
 * Proeves FOER udelukkelserne, saa varen bliver maalt paa den kategori, den
 * faktisk ender i. Foerste traef vinder.
 */
const OPSLAG_FINERE: Record<string, { navn: RegExp; kategori: string }[]> = {
  campingmobler: [
    {
      // Bevidst snaevert. Et bredt \bseat\b ville tage en stol, der tilfaeldigvis
      // har "seat" i navnet, med over i siddeunderlag.
      navn: /\b(?:seat|sit)\s*pad\b|\bsiddeunderlag\b|\bsiddepude\b|\bseat cushion\b|\b(?:air|v|heat)[\s-]?seat\b/i,
      kategori: "siddeunderlag",
    },
  ],
};

export const FEED_KATEGORI_MAP: Record<string, Record<string, string>> = {
  outnorth: {
    // Ly
    Tunneltelte: "telt",
    Kuppeltelte: "telt",
    Campingtelte: "telt",
    Tipitelte: "telt",
    "Tarp & Shelters": "tarp",
    // Soevn
    Dunsoveposer: "sovepose",
    "Syntetiske soveposer": "sovepose",
    "Oppustelige liggeunderlag": "liggeunderlag",
    "Selvoppustelige liggeunderlag": "liggeunderlag",
    Skumliggeunderlag: "liggeunderlag",
    Puder: "soveudstyr",
    Hængekøjer: "haengekoje",
    // Baeren
    "Outdoor-rygsække": "rygsaek",
    "Pakposer og organizere": "taske",
    // Lys
    Pandelamper: "pandelampe",
    Lygter: "lygte",
    Lommelygter: "lygte",
    "Andre lamper": "lygte",
    // Koekken og vand
    Trekkøkkener: "kogeudstyr",
    Campingkøkkener: "kogeudstyr",
    Køkkenudstyr: "kogeudstyr",
    Flasker: "drikkedunk",
    Termoflasker: "drikkedunk",
    Friluftsmad: "mad",
    Vandrensning: "vandfilter",
    // Vaerktoej, navigation og lejr
    Knive: "kniv",
    Multiværktøj: "kniv",
    Kompasser: "navigation",
    Kikkert: "kikkert",
    Vandrestave: "vandrestav",
    Førstehjælp: "foerstehjaelp",
    "Powerbanker & opladere": "elektronik",
    Campingmøbler: "campingmobler",
    Insektbeskyttelse: "myggenet",
    Toiletartikler: "hygiejne",
    // Toej og fodtoej
    Friluftsbukser: "vandrebukser",
    Regnjakker: "regntoj",
    Regnbukser: "regntoj",
    Regnsæt: "regntoj",
    Dunjakker: "dunjakke",
    "Dunjakker mellemlag": "dunjakke",
    Outdoorhandsker: "handsker",
    Huer: "hue",
    Friluftsstrømper: "sokker",
    "Baselayer overdel": "undertoj",
    "Baselayer bukser": "undertoj",
    "Baselayer sæt": "undertoj",
    Gamacher: "gamacher",
    Vandrestøvler: "fodtoj",
    Vandresko: "fodtoj",
  },
};

/**
 * Den ShelterDK-kategori en vare hoerer til, eller null hvis den skal lades
 * ligge. Foerste match vinder, saa raekkefoelgen ovenfor er betydende:
 * en dunvest skal vaere dunjakke og ikke isoleringsvest.
 */
export function kategoriFor(
  produktnavn: string,
  kategorinavn: string | null,
  retailer?: string
): string | null {
  const navn = produktnavn || "";
  const blob = `${navn} ${kategorinavn ?? ""}`;
  if (ALDRIG.test(blob)) return null;

  // Et feed med sin egen flade kategoriliste spoerges foerst. Udelukkelsen
  // deles med reglerne nedenfor, saa et opslag ikke bliver en bagdoer uden om
  // det, de holder ude.
  const kort = retailer ? FEED_KATEGORI_MAP[retailer] : undefined;
  const fraKort = kort && kategorinavn ? kort[kategorinavn.trim()] : undefined;
  if (fraKort) {
    const kat = OPSLAG_FINERE[fraKort]?.find((r) => r.navn.test(navn))?.kategori ?? fraKort;
    if (TILBEHOER_OPSLAG.test(navn)) return null;
    if (OPSLAG_UDELUK[kat]?.test(navn)) return null;
    const regel = FEED_KATEGORIER.find((x) => x.kategori === kat);
    return regel && regel.udeluk.test(navn) ? null : kat;
  }

  for (const k of FEED_KATEGORIER) {
    const kilde = k.kunNavn ? navn : blob;
    if (k.inkluder.test(kilde) && !k.udeluk.test(navn)) return k.kategori;
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
