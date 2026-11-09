/**
 * Produktnavnet som et menneske ville skrive det, udledt af feedets navn.
 *
 * Feedene skriver ikke produktnavne, de skriver kataloglinjer. Maalt
 * 1. november 2026 havde 242 af de 362 varer i udgivne guider (67%) stoej i
 * navnet, og 203 af dem havde slet ingen `brand`:
 *
 *   "Stol - Treklife Low-back UL Chair"
 *   "Sovepose - Nordisk Bjarni +10 - Mummy - XL"
 *   "Camelbak Thrive Flip Straw 32oz - Oxford - Str. 1L / 32 oz - Drikkeflaske"
 *   "Dry bag - 8 liter"
 *
 * Det er et SOEGEPROBLEM og ikke kun grimt. Folk soeger "Treklife Low-back UL
 * Chair", ikke "Stol - Treklife Low-back UL Chair", og navnet gaar uaendret ud
 * i tre flader: hub-kortet, ItemList-skemaet og llms.txt, hvor der i dag staar
 * "Foerstevalg: Dry bag - 8 liter" uden hverken maerke eller model. En
 * produktside kan ikke rangere paa det den handler om, naar dens titel
 * indeholder feedets kategoriord.
 *
 * ARBEJDSDELINGEN er den samme som i kategori-kaeden: koden udleder, og
 * databasen holder kun de rettelser et menneske har lavet. `display_name` og
 * `display_brand` (migration 066) staar bevidst UDEN FOR synkens
 * upsert-payload, saa de overlever natten. At rette `product_name` eller
 * `brand` direkte er nyttesloest: synken skriver praecis de to kolonner ved
 * hver koersel. Det var samme faelde som `category_mapped`.
 *
 * Udledningen er ikke perfekt og skal ikke vaere det. `navnBehoeverHaand()`
 * siger hvornaar den ikke kan naa frem til noget brugbart, og de varer skal
 * have et `display_name` skrevet i haanden. "Dry bag - 8 liter" har hverken
 * maerke eller model i feedet, saa ingen regel kan redde den.
 */

/**
 * Maerker der optraeder i navnene hos de feeds som IKKE udfylder `brand`.
 *
 * Listen skal kun daekke dem: for de 11.267 varer hvor `brand` er udfyldt,
 * bruges feltet. Maalt 1. november 2026 mangler 2.124 varer et maerke, heraf
 * 2.101 fra backpackerlife, som skriver navnet som "Type - Maerke Model -
 * specs". Maerket staar altsaa i starten af andet segment.
 *
 * De flerordede staar foerst og laengste match vinder, ellers bliver "Black
 * Diamond Storm 450" til maerket "Black" og "Sea to Summit Spark" til "Sea".
 *
 * Listen er udledt af data og ikke skoennet: kandidaterne er de foerste ét til
 * tre ord i andet segment, taelt over alle backpackerlife-navne, og kun de
 * der gaar igen. Treklife (170), Highlander (122), High Peak (30),
 * Snugpak (28), Aquipe (14) og Mil-Tec (12) staar her, fordi ingen anden
 * forhandler foerer dem og de derfor ikke findes i `brand`-ordforraadet.
 */
const MAERKER = [
  // Flerordede foerst.
  "Sea to Summit",
  "Black Diamond",
  "Jack Wolfskin",
  "Light My Fire",
  "Adventure Food",
  "Tactical Foodpack",
  "The Brew Company",
  "High Peak",
  "La Sportiva",
  "Big Agnes",
  "Trek'n Eat",
  "Mountain Equipment",
  "The North Face",
  "Easy Camp",
  "Arctic Tern",
  "Helly Hansen",
  "Outdoor Research",
  "Terra Nova",
  "Hennessy Hammock",
  "GSI Outdoors",
  "Ticket to the Moon",
  "Tasmanian Tiger",
  "Darn Tough",
  "Nordic Peak",
  "Think Tank",
  "Red Chili",
  "Park Tool",
  // Enkeltordede.
  "Treklife",
  "Highlander",
  "Trespass",
  "Merrell",
  "Trangia",
  "Gregory",
  "Nordisk",
  "Montane",
  "Lifeventure",
  "LifeVenture",
  "Snugpak",
  "Klymit",
  "Camelbak",
  "Lifesystems",
  "Carinthia",
  "Jetboil",
  "LifeStraw",
  "Grangers",
  "Tatonka",
  "Nemo",
  "Cotopaxi",
  "TravelSafe",
  "Esbit",
  "Katadyn",
  "Gerber",
  "Teva",
  "Petzl",
  "ECCO",
  "Stanley",
  "Primus",
  "Opinel",
  "Columbia",
  "Carson",
  "Pacsafe",
  "Silva",
  "Nalgene",
  "Ulvang",
  "Nikwax",
  "Feuerhand",
  "Victorinox",
  "Wacaco",
  "Optimus",
  "Morakniv",
  "Cocoon",
  "Keen",
  "Compeed",
  "Pharmavoyage",
  "Aquipe",
  "Mil-Tec",
  "Stormguard",
  "Sleepline",
  "Haglöfs",
  "Fjällräven",
  "Deuter",
  "Osprey",
  "Exped",
  "Vaude",
  "Outwell",
  "Robens",
  "Helsport",
  "Lundhags",
  "Pinewood",
  "Aclima",
  "Devold",
  "Icebreaker",
  "Bergans",
  "Berghaus",
  "Leatherman",
  "Nitecore",
  "Edelrid",
  "Edelweiss",
  "Coghlans",
  "Petromax",
  "Pajak",
  "BioLite",
  "HydraPak",
  "LittleLife",
  "Nordisk",
  "Kupilka",
  "Garmin",
  "Suunto",
  "Thermarest",
  "Therm-a-Rest",
  "Hydrapak",
  "Muurikka",
  "Fiskars",
  "Hultafors",
  "Øyo",
  "OMM",
  "Artac",
].sort((a, b) => b.length - a.length);

/**
 * Generiske ord der staar som `brand` hos en forhandler, men som ikke kan
 * genkendes i et navn.
 *
 * Maalt: "Pro" er et rigtigt maerke (PRO cykeldele), men `\bpro\b` i et navn
 * rammer "Vidda Pro Lite", "Saruk Pro 60" og "Ether Light XR Pro". Det samme
 * gaelder "Elite", "Discovery", "Nomad" og "Cruz". De bruges derfor kun naar
 * de staar i `brand`-feltet, aldrig genkendt fra navnet.
 */
const FOR_GENERISKE = new Set(["pro", "elite", "discovery", "nomad", "cruz", "jaeger", "mountain", "outdoor", "trek", "trail", "basic", "classic", "original"]);

/** Danske typeord feedene saetter foran eller bagefter. Aldrig en del af navnet. */
const TYPEORD =
  /^(?:sovepose|dunsovepose|b(?:ø|oe)rnesovepose|sommersovepose|lagenpose|liggeunderlag|selvoppustelig liggeunderlag|siddeunderlag|telt|letv(?:æ|ae)gtstelt|familietelt|tipi telt|tarp|rygs(?:æ|ae)k|vandrerygs(?:æ|ae)k|hydration rygs(?:æ|ae)k|taske|b(?:æ|ae)ltetaske|toilettaske|opbevaringspose|pakkeposer(?: i net)?|pakpose|dry bag|t(?:ø|oe)rs(?:æ|ae)k|stol|bord|pandel(?:æ|ae)mpe|pandelampe(?: opbevaringspose og lanterne)?|lygte|lommelygte|lanterne|powerbank|kompas|kikkert|kniv|multi-?tool|(?:ø|oe)kse|sav|spork(?: kit)?|bestik|koges(?:æ|ae)t|kogesystem|kasserolle|gryde|stegepande|pande|b(?:å|aa)lpande|st(?:o|oe)rmk(?:ø|oe)kken|spritbr(?:æ|ae)nder|gasbr(?:æ|ae)nder|br(?:æ|ae)nder|multidisc|drikkeflaske|drikkedunk|vandfilter|vanddunk|h(?:å|aa)ndkl(?:æ|ae)de|hue|kasket|handsker|handske|sokker|str(?:ø|oe)mper|vandrestr(?:ø|oe)mper|vandresokker|jakke|regnjakke|fleecetr(?:ø|oe)je|fleecejakke|bukser|vandrebukser|regnbukser|uldundert(?:ø|oe)j|uldundertr(?:ø|oe)je|undertr(?:ø|oe)je|t-shirt|gamacher|gaiters|st(?:ø|oe)vler|vandrest(?:ø|oe)vler|vandresko|sko|sandal|sandaler|vandresandal|h(?:æ|ae)ngek(?:ø|oe)je|myggenet|f(?:ø|oe)rstehj(?:æ|ae)lpss(?:æ|ae)t|t(?:æ|ae)ndst(?:å|aa)l|solhat|b(?:ø|oe)llehat|teltpl(?:ø|oe)kker|teltst(?:æ|ae)nger|ekstra teltst(?:æ|ae)nger|sovepude|rejsepude|pude|skovl|tr(?:æ|ae)kvogn|pavillon|klatreudstyr|tilbeh(?:ø|oe)r|fryset(?:ø|oe)rret mad|mad|vandrestav|vandrestave|s(?:æ|ae)be|vaskemiddel|te|skopose(?: fra \w+)?|drybag|dry bag(?: med kompression| s(?:æ|ae)t)?|pakpose|pandeb(?:å|aa)nd|base layer|uldunderbukser|underbukser|uldtr(?:ø|oe)je|hue med kvast|hurtigt(?:ø|oe)rrende (?:microfiber )?h(?:å|aa)ndkl(?:æ|ae)de|cooling towel|k(?:ø|oe)lende)(?:\s+(?:til\s+)?(?:herre|herrer|dame|damer|kvinder|m(?:æ|ae)nd|b(?:ø|oe)rn|junior|unisex))?$/i;

/** Farver feedene haenger paa som eget segment. */
const FARVE =
  /^(?:sort|sorte|gr(?:å|aa)|bl(?:å|aa)|gr(?:ø|oe)n|hvid|r(?:ø|oe)d|navy|sand|khaki|rust|oliv(?:en?)?|beige|brun|gul|lilla|pink|turkis|orange|m(?:ø|oe)rkegr(?:å|aa)|m(?:ø|oe)rkebl(?:å|aa)|gennemsigtig|black|grey|gray|blue|green|white|red|yellow|purple|teal|charcoal|navy blue|dark \w+|light \w+|no colour|no color)$/i;

/** Stoerrelses- og lagersegmenter. */
const STOERRELSE = /^(?:str\.?\s*.*|(?:xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|one\s*size|os)|\d{2,3})$/i;
const LAGER = /\((?:[^)]*tilbage[^)]*)\)/gi;

/**
 * Ensretter mellemrum og segmentskel.
 *
 * Bindestregen normaliseres KUN naar der staar mellemrum paa begge sider.
 * Ellers blev "Treklife Low-back UL Chair" til "Low - back" og dermed to
 * segmenter, og det samme skete for "G-loft", "Zip-off", "Ultra-Sil" og
 * "Nap-Pak". Backpackerlifes dobbelte mellemrum ("Fleecetroeje dame  -  ...")
 * er daekket, fordi \s+ ogsaa rammer to mellemrum.
 */
function ensret(s: string): string {
  return s
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

function nrm(s: string): string {
  let t = s.toLowerCase();
  for (const [a, b] of [["ö", "o"], ["ä", "a"], ["å", "a"], ["æ", "ae"], ["ø", "o"], ["é", "e"]] as const) {
    t = t.split(a).join(b);
  }
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Maerket, i den stavning der skal vises.
 *
 * Raekkefoelgen er: menneskets rettelse, feedets felt, og til sidst genkendelse
 * i navnet. Det sidste er kun for de feeds der ikke udfylder `brand`.
 */
export function rentMaerke(p: {
  product_name?: string | null;
  brand?: string | null;
  display_brand?: string | null;
}): string | null {
  const manuelt = (p.display_brand ?? "").trim();
  if (manuelt) return manuelt;

  const felt = (p.brand ?? "").trim();
  if (felt) return felt;

  const navn = nrm(ensret(p.product_name ?? ""));
  if (!navn) return null;
  for (const m of MAERKER) {
    const nm = nrm(m);
    if (nm.length < 3 || FOR_GENERISKE.has(nm)) continue;
    if (new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(navn)) return m;
  }
  return null;
}

/**
 * Produktnavnet til visning: titel, overskrift, kort, skema og llms.txt.
 *
 * Udledningen fjerner segmenter der aldrig er en del af navnet (typeord,
 * farve, stoerrelse, lagerbesked) og saetter maerket foran, hvis det mangler.
 * Maalinger og eksempler staar i testene.
 */
export function rentNavn(p: {
  product_name?: string | null;
  brand?: string | null;
  display_name?: string | null;
  display_brand?: string | null;
}): string {
  const manuelt = (p.display_name ?? "").trim();
  if (manuelt) return manuelt;

  const raa = ensret(p.product_name ?? "");
  if (!raa) return "";

  const maerke = rentMaerke(p);
  const segmenter = raa
    .split(" - ")
    .map((s) => s.replace(LAGER, "").trim())
    .filter(Boolean);

  // DEN STRUKTURELLE REGEL, og den baerer det meste.
  //
  // Backpackerlife og outdoortid skriver "Typebeskrivelse - Maerke Model -
  // specs". Typebeskrivelsen staar altid foerst, og maerket i et senere
  // segment. Alt foer det segment, maerket staar i, er altsaa feedets egen
  // beskrivelse og ikke en del af navnet.
  //
  // Det er med vilje en strukturel regel og ikke en ordliste. Et foersoeg med
  // en liste over danske typeord manglede straks "Base layer unisex", "Hue med
  // kvast", "Dry bag med kompression", "Hurtigtoerrende microfiber haandklaede"
  // og "Pandebaand", og den slags liste bliver aldrig faerdig. Strukturen
  // haendrer sig ikke.
  //
  // Outmore skriver omvendt "Maerke Model - Farve - Str. X - Type", saa dér
  // staar maerket i foerste segment og intet droppes foran. Haleenderne tages
  // af moenstrene nedenfor.
  let beholdt = segmenter;
  const nmMaerke = maerke ? nrm(maerke) : "";
  const maerkeINavnet = Boolean(nmMaerke) && segmenter.some((s) => nrm(s).includes(nmMaerke));
  if (maerkeINavnet) {
    const foerste = segmenter.findIndex((s) => nrm(s).includes(nmMaerke));
    if (foerste > 0) beholdt = segmenter.slice(foerste);
  }

  // Farve og stoerrelse er aldrig en del af navnet, uanset hvad der ellers staar.
  beholdt = beholdt.filter((s) => !(FARVE.test(s) || STOERRELSE.test(s)));

  // Typeordet maa KUN fjernes, naar der er et modelnavn at falde tilbage paa,
  // altsaa naar maerket staar i navnet. Ellers er typebeskrivelsen alt varen
  // har: "Hurtigtoerrende microfiber haandklaede - 120 x 60 cm - Graa" har
  // maerket "Trek Trail" i feltet men ikke i navnet, og en stripning efterlod
  // "Trek Trail 120 x 60 cm", som ikke er et produktnavn. Med betingelsen
  // bliver det "Trek Trail Hurtigtoerrende microfiber haandklaede 120 x 60 cm".
  if (maerkeINavnet) {
    const uden = beholdt.filter((s) => !TYPEORD.test(s));
    if (uden.length > 0) beholdt = uden;
  }

  // Alt var stoej. Saa er feedets navn det eneste der findes, og haanden maa
  // til: "Dry bag - 8 liter" har hverken maerke eller model.
  if (beholdt.length === 0) beholdt = segmenter;

  let ud = beholdt.join(" ").replace(/\s+/g, " ").trim();

  // Blev der KUN maerket tilbage, var der ingen model at skaere ind til, og
  // typebeskrivelsen skulle have vaeret beholdt. Maalt paa "Myggenet til
  // hovedet - Treklife", "Myggenet til hovedet - Lifesystems" og "Mikropude -
  // Highlander", der alle blev til bare maerkenavnet.
  if (nmMaerke && nrm(ud) === nmMaerke) {
    ud = segmenter
      .filter((s) => !(FARVE.test(s) || STOERRELSE.test(s)))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Maerket maa kun staa én gang. Feedet skriver det to gange paa to maader:
  // forrest med to stavninger ("Trek n' eat Trek'n Eat Jaegergryde ...") og
  // forrest plus bagerst ("Opinel N8 stainless ... boeg Boeg Opinel"). Alle
  // forekomster efter den foerste ryger ud.
  if (maerke) {
    const nm = nrm(maerke);
    // Vinduet skal kunne variere. Feedet skriver samme maerke med forskelligt
    // antal ord: "Trek n' eat" er tre tokens og "Trek'n Eat" er to, men begge
    // normaliserer til "trek n eat". En fast bredde fandt kun den ene.
    const maxBredde = nm.split(" ").length + 1;
    const ord = ud.split(" ");
    const beholdt: string[] = [];
    let setFoer = false;
    for (let i = 0; i < ord.length; ) {
      let traf = 0;
      for (let b = Math.min(maxBredde, ord.length - i); b >= 1; b--) {
        if (nrm(ord.slice(i, i + b).join(" ")) === nm) {
          traf = b;
          break;
        }
      }
      if (traf > 0) {
        if (!setFoer) {
          // Den kanoniske stavning, ikke feedets. "Trek n' eat Trek'n Eat ..."
          // skal blive "Trek'n Eat ...", saa samme maerke staver ens overalt
          // paa sitet. Det er ogsaa det en soegemaskine skal kunne genkende
          // som den samme entitet paa tvaers af vores sider.
          beholdt.push(...maerke.split(" "));
          setFoer = true;
        }
        i += traf;
        continue;
      }
      beholdt.push(ord[i]);
      i++;
    }
    ud = beholdt.join(" ");
  }

  // Maerket foerst, saa navnet laeses som folk skriver det i soegefeltet.
  //
  // To faelder, begge maalt. (1) Staar maerket et andet sted i navnet, skal
  // det FLYTTES og ikke tilfoejes, ellers blev "Uldunderbukser herre - 100%
  // merino uld - Treklife" til "Treklife ... merino uld Treklife". (2) Feedets
  // `brand` kan vaere laengere end det navnet bruger: brand "Columbia
  // Sportswear" mod navnet "Columbia Mountain Croo III". Begynder navnet med
  // maerkets foerste ord, staar maerket der allerede.
  if (maerke) {
    const nm = nrm(maerke);
    const nu = nrm(ud);
    const foersteOrd = nm.split(" ")[0];
    if (!nu.startsWith(nm) && !nu.startsWith(foersteOrd)) {
      if (nu.includes(nm)) {
        // Fjern forekomsten inde i navnet, saa den ikke staar to gange.
        const ord = ud.split(" ");
        const antal = nm.split(" ").length;
        for (let i = 0; i + antal <= ord.length; i++) {
          if (nrm(ord.slice(i, i + antal).join(" ")) === nm) {
            ord.splice(i, antal);
            break;
          }
        }
        ud = ord.join(" ");
      }
      ud = `${maerke} ${ud}`;
    }
  }

  return ud
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–,.]+|[\s\-–,.]+$/g, "")
    .trim();
}

/**
 * Sandt naar udledningen ikke kan naa frem til et brugbart navn, og en
 * `display_name` skal skrives i haanden.
 *
 * De tre tilfaelde er maalt: intet maerke nogen steder, et navn der er skrumpet
 * til under to ord, og et navn der begynder med et tal, fordi typeordet foran
 * var det eneste indhold ("Dry bag - 8 liter" bliver "8 liter").
 */
export function navnBehoeverHaand(p: {
  product_name?: string | null;
  brand?: string | null;
  display_name?: string | null;
  display_brand?: string | null;
}): boolean {
  if ((p.display_name ?? "").trim()) return false;
  const navn = rentNavn(p);
  if (!navn) return true;
  if (!rentMaerke(p)) return true;
  if (navn.split(" ").filter(Boolean).length < 2) return true;
  // Et navn der BEGYNDER med et maal er et typeord der blev fjernet, og intet
  // andet: "Dry bag - 8 liter" bliver "8 liter". Et vilkaarligt ciffer er
  // derimod fint, og flagede ellers "66°North Mens Keilir Hooded Down Jacket".
  if (/^\d+(?:[.,]\d+)?\s*(?:l\b|liter|ml|cl|cm|mm|g\b|kg|stk|dele|personer|par)/i.test(navn)) return true;
  return false;
}

/**
 * Foerste ord uden tegnsaetning, smaa bogstaver. Bruges til at afgoere om et
 * maerke allerede staar i navnet, saa et kort ikke skriver det to gange.
 *
 * Optalt 9. november 2026 over de 362 varer i publicerede guider: 307 har
 * hele maerket som optakt til navnet ("Light My Fire" + "Light My Fire
 * FireSteel BIO"). De sidste otte med maerke er samme ord med en
 * stavevariant: "Coghlan's" mod "Coghlans", "Columbia Sportswear" mod
 * "Columbia ...". En prefix-test fanger de 307, men ikke de otte, saa
 * sammenligningen gaar paa foerste ord uden tegn.
 */
export function foersteOrd(s: string): string {
  return (s.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9æøå]/g, "");
}
