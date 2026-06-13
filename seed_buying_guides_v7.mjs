// Seed v7: niche-klynge (drikkedunk, tændstål & optænding, handsker, hue, siddeunderlag).
// Samme idempotente mønster som tidligere seeds. Kør: node seed_buying_guides_v7.mjs
import fs from "node:fs";

function loadEnv(p) {
  try {
    for (const l of fs.readFileSync(p, "utf8").split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env["_" + m[1]]) process.env["_" + m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
["web/.env.local", "web/.env", ".env.local", ".env"].forEach(loadEnv);
const URL = process.env._NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env._SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Mangler Supabase env"); process.exit(1); }
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const TODAY = new Date().toISOString();
const AUTHOR = "ShelterDK Redaktionen";

const DISCLOSURE_FAQ = { q: "Tjener ShelterDK penge på anbefalingerne?", a: "Ja — når du køber via et link i guiden, får vi en kommission. Det koster ikke dig ekstra, og det påvirker ikke rangeringen: vi scorer efter værdi, egnethed, brand og tilgængelighed, ikke efter kommission. Se vores metode på /saadan-vurderer-vi." };

const guides = [
  // ───────────────────────── DRIKKEDUNK ─────────────────────────
  {
    slug: "drikkedunk",
    title: "Bedste drikkedunk 2026",
    category: "drikkedunk",
    seo_title: "Bedste drikkedunk 2026 – Nalgene & CamelBak til vandring | ShelterDK",
    seo_description: "Find den bedste drikkedunk til shelterture og vandring. Vi scorer 6 favoritter — Nalgene, CamelBak og Primus, bidventil og børn, fra 119 til 179 kr.",
    intro: "En god drikkedunk er turgrej du bruger hver eneste dag — den skal være tæt, holdbar og nem at drikke af i bevægelse. Vi har scoret de bedste drikkedunke til shelterture og vandring: de uopslidelige klassikere fra Nalgene, CamelBaks bidventiler og lette alternativer.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Nalgene – bottle materials & BPA-free", url: "https://nalgene.com/" },
      { title: "OutdoorGearLab – best water bottles", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-water-bottle" },
    ],
    faq: [
      { q: "Wide mouth eller narrow mouth?", a: "Wide mouth (bred åbning) er nem at fylde, lægge isterninger i, blande pulver i og rengøre — men kan plaske, når du drikker i bevægelse. Narrow mouth (smal åbning) er lettere at drikke af uden at spilde, mens du går. Til de fleste vinder wide mouth på alsidighed; vil du drikke i farten, så vælg narrow eller en bid-/sugeventil." },
      { q: "Hård flaske eller bid-/sugeventil?", a: "En hård Tritan-flaske (Nalgene-typen) er stort set uopslidelig, tåler kogende vand og kulde, og er nem at rengøre — det robuste standardvalg. En flaske med bidventil eller sugerør (CamelBak) lader dig drikke håndfrit uden at skrue låg af — rart under gang og cykling. Bidventiler har til gengæld flere dele at holde rene." },
      { q: "Er Tritan/plast sikkert at drikke af?", a: "Moderne friluftsflasker som Nalgene og CamelBak er lavet af BPA-fri Tritan-plast, der er godkendt til fødevarekontakt og tåler både varmt og koldt indhold. Det er holdbart, let og smagsneutralt. Vil du helt undgå plast, findes der stålflasker — de er dog tungere og kan give metalsmag ved varmt indhold." },
      { q: "Hvor stor en drikkedunk skal jeg have?", a: "1 liter er standardstørrelsen til en vandredag — stor nok til at du ikke skal fylde konstant, lille nok til lommen på rygsækken. Til korte ture eller børn rækker 350-500 ml; til varme dage eller hvor vand er langt væk, kan to literflasker være bedre end én stor og tung. Husk at vand vejer 1 kg pr. liter." },
      { q: "Kan jeg bruge drikkedunken til varm te eller kogt vand?", a: "Tritan-flasker (Nalgene m.fl.) tåler varmt vand og te fint, men de isolerer ikke — drikken bliver hurtigt kold, og flasken bliver varm at holde. Vil du holde på varmen, skal du bruge et termokrus eller en termoflaske. Til at rense flasken kan du trygt skylde med kogende vand." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige drikkedunk\n\nDrikkedunken er noget af det mest brugte grej på turen — du har den i hånden mange gange om dagen. Den skal være **tæt** (intet er værre end en lækket flaske i rygsækken), **holdbar** og **nem at drikke af**. Tre valg afgør resten: åbningstype, drikkemekanisme og størrelse.\n\n## Wide mouth vs. narrow mouth\n\n**Wide mouth** (bred åbning) er den alsidige: nem at fylde, lægge is i, blande elektrolyt-pulver i og rengøre i bunden. **Narrow mouth** (smal åbning) er lettere at drikke af uden at plaske, mens du går. Til de fleste er wide mouth det rigtige; vil du drikke i farten, så vælg narrow eller en ventil.\n\n## Hård flaske vs. bidventil\n\n- **Hård Tritan-flaske (Nalgene):** stort set uopslidelig, tåler varmt og koldt, nem at rense. Det robuste standardvalg.\n- **Bidventil/sugerør (CamelBak):** drik håndfrit uden at skrue låg af — rart under gang. Flere dele at holde rene.\n\n## Materiale og sikkerhed\n\nFriluftsflasker er i **BPA-fri Tritan-plast**: let, holdbart, smagsneutralt og godkendt til mad. De tåler varmt og koldt, men **isolerer ikke** — skal drikken holdes varm eller iskold, skal du bruge et termokrus. Stålflasker findes, men er tungere.\n\n## Størrelse\n\n**1 liter** er standard til en vandredag. Husk at vand vejer 1 kg/liter — på varme dage hvor kilden er langt væk, kan to literflasker være klogere end én stor. Til børn og korte ture rækker 350-500 ml.\n\n## Vores anbefaling\n\nTil de fleste: Nalgene Wide Mouth 1 liter — den uopslidelige klassiker, der holder i årevis og passer i enhver rygsæk-lomme. Vil du drikke håndfrit under gang, så vælg CamelBak Eddy+ med bidventil. Og pak en lille flaske eller en børneflaske, hvis de mindste er med.`,
    entries: [
      { product_id: "backpackerlife-754651", score: 8.8, award_label: "Bedst i test", best_for: "Alround vandring", editorial_note: "Nalgene Wide Mouth 1L er friluftsflaskernes guldstandard: nærmest uopslidelig BPA-fri Tritan, tæt skruelåg, og en bred åbning der er let at fylde og rense. Holder i årevis — vores alround-vinder.", pros: ["Stort set uopslidelig", "Tæt skruelåg", "Bred åbning — let at fylde/rense"], cons: ["Plasker lidt i bevægelse", "Isolerer ikke"], specs: { type: "hård flaske", aabning: "wide mouth", volumen: "1 L", materiale: "Tritan BPA-fri" } },
      { product_id: "backpackerlife-754662", score: 8.3, award_label: "Bedste kompakte", best_for: "Korte ture / lille rygsæk", editorial_note: "Nalgene Wide Mouth 500 ml er lillesøsteren til testvinderen: samme uopslidelige kvalitet i et kompakt format til dagsture, børn eller som ekstra-flaske. Lav pris.", pros: ["Kompakt og let", "Samme robuste kvalitet", "God pris"], cons: ["Lille kapacitet", "Skal fyldes oftere"], specs: { type: "hård flaske", aabning: "wide mouth", volumen: "0,5 L", materiale: "Tritan BPA-fri" } },
      { product_id: "backpackerlife-48456", score: 8.5, award_label: "Bedste med bidventil", best_for: "Drik håndfrit", editorial_note: "CamelBak Eddy+ 1L lader dig drikke håndfrit gennem en bidventil — bid og sug uden at skrue låg af. Rart under gang og cykling, og ventilen kan lukkes mod lækage.", pros: ["Håndfri bidventil", "Låsbar mod lækage", "1 liters kapacitet"], cons: ["Flere dele at rengøre", "Ventil kan tilstoppe over tid"], specs: { type: "bidventil-flaske", volumen: "1 L", materiale: "Tritan BPA-fri" } },
      { product_id: "backpackerlife-923683", score: 8.2, award_label: "Bedste letvægt", best_for: "Gram-tællere", editorial_note: "Primus Kvarts Tritan 1L er det lette alternativ til Nalgene: samme robuste Tritan i en lidt slankere, lettere konstruktion. Fin balance mellem vægt og holdbarhed.", pros: ["Lettere end Nalgene", "Robust Tritan", "Slank pasform i lommen"], cons: ["Mindre ikonisk hårdfør", "Standard skruelåg"], specs: { type: "hård flaske", volumen: "1 L", materiale: "Tritan BPA-fri" } },
      { product_id: "backpackerlife-754680", score: 8.4, award_label: "Bedste enhåndsbetjening", best_for: "Drik mens du går", editorial_note: "Nalgene OTF (On The Fly) Sustain 700 ml har et klaplåg du åbner og drikker af med én hånd — Nalgene-holdbarhed kombineret med en drikketud til farten. Lavet af genbrugsmateriale.", pros: ["Enhånds klaplåg", "Drik uden at stoppe", "Genbrugsmateriale"], cons: ["Llåg-mekanik = flere dele", "Mellem kapacitet"], specs: { type: "klaplåg-flaske", volumen: "0,7 L", materiale: "Tritan Sustain (genbrug)" } },
      { product_id: "backpackerlife-815125", score: 8.1, award_label: "Bedste til børn", best_for: "De mindste på tur", editorial_note: "Nalgene Kids OTF 350 ml er børneudgaven: let, farverig og med et enhånds klaplåg, de selv kan betjene — i samme uopslidelige Nalgene-kvalitet. Perfekt til familieturen.", pros: ["Børnevenligt klaplåg", "Let og kompakt", "Uopslidelig kvalitet"], cons: ["Lille til voksne", "Klaplåg skal renses"], specs: { type: "børneflaske", volumen: "0,35 L", materiale: "Tritan BPA-fri" } },
    ],
  },

  // ─────────────────── TÆNDSTÅL & OPTÆNDING ───────────────────
  {
    slug: "taendstaal",
    title: "Bedste tændstål & optænding 2026",
    category: "optaending",
    seo_title: "Bedste tændstål & optænding 2026 – ildstål til bål & shelter | ShelterDK",
    seo_description: "Find det bedste tændstål og optænding til bål på shelterture. Vi scorer 6 favoritter — ildstål og tinder fra Light My Fire, Lifesystems og SOL, fra 29 til 89 kr.",
    intro: "Et bål er halvdelen af shelterhyggen — men kun hvis du kan tænde det, også når veddet er klamt. Vi har scoret det bedste tændstål (ildstål) og den bedste optænding (tinder): det der får gløderne i gang i blæst og fugt, hvor en almindelig lighter giver op.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Light My Fire – Swedish FireSteel", url: "https://lightmyfire.com/" },
      { title: "Naturstyrelsen – bål og bålforbud", url: "https://naturstyrelsen.dk/" },
    ],
    faq: [
      { q: "Hvorfor tændstål frem for en lighter?", a: "Et tændstål (ildstål) virker, hvor lighteren svigter: i blæst, kulde og selv vådt, og det løber aldrig tør for gas. Det giver en 3.000°C gnist hver gang — tusindvis af tændinger pr. stål. Den kloge har begge dele: en lighter til hverdag og et tændstål som det der altid virker, når det gælder." },
      { q: "Hvad er tinder/optænding, og hvorfor har jeg brug for det?", a: "Tinder er let-antændeligt optændingsmateriale, der fanger gnisten fra tændstålet og holder flammen længe nok til at antænde pindebrænde. Fugtigt ved og vådt vejr gør optænding næsten umuligt uden — en håndfuld tinder er forskellen mellem et bål og en frustrerende aften. Birkebark, fedttræ og fabriks-tinder virker alle." },
      { q: "Kan tændstål tænde vådt brænde?", a: "Tændstålet giver gnisten, men den kan ikke i sig selv antænde vådt, tykt ved. Du skal bygge bålet rigtigt: gnist i tør tinder, tinderen antænder tynde tørre pinde, og derfra bygger du op til større brænde. I vådt vejr er medbragt tinder (der brænder selv fugtig) afgørende — det er derfor optænding og tændstål hører sammen." },
      { q: "Hvor længe holder et tændstål?", a: "Et almindeligt tændstål rækker til flere tusinde tændinger — det holder typisk mange år, selv for den flittige bålmager. Større stål holder længere end de tynde nød-modeller. Det er et engangskøb, der følger dig fra tur til tur, så det betaler sig at vælge et solidt ét frem for det tyndeste." },
      { q: "Må jeg overhovedet lave bål på shelterpladsen?", a: "Kun på pladser med en anlagt bålplads, og kun når der ikke er bålforbud. Tjek altid pladsens regler og aktuelle bålforbud på Naturstyrelsens hjemmeside, før du tænder op. I tørre somre er forbud almindelige — så er et stormkøkken alternativet til varm mad. Efterlad altid bålpladsen som du fandt den." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du tændstål & optænding\n\nAt kunne tænde bål pålideligt er en kernefærdighed i shelterlivet — og det handler om to ting der hører sammen: **gnisten** (tændstål/ildstål) og **det der fanger gnisten** (tinder/optænding). En lighter er fin i tørt vejr, men tændstål og tinder er det, der virker når det blæser, fryser og er fugtigt.\n\n## Tændstål: gnisten der altid virker\n\nEt **tændstål** (ferrocerium-stål) giver en 3.000°C gnist, uanset blæst, kulde og fugt — og løber aldrig tør for gas. Du skraber med en skarp kant og sender en byge af gnister ned i din tinder. Ét stål holder til tusindvis af tændinger. Vælg et solidt frem for det tyndeste nød-stål, hvis du laver bål ofte.\n\n## Optænding: tinderen der fanger gnisten\n\nGnisten alene tænder ikke vådt ved. Du skal have **tinder**: let-antændeligt materiale der griber gnisten og brænder længe nok til at antænde pindebrænde. Fabriks-tinder (som Light My Fire TinderSticks eller SOL Tinder-Quik) brænder selv fugtig — den afgørende fordel i vådt dansk vejr. Birkebark og fedttræ virker også, hvis du kan finde det tørt.\n\n## Sådan bygger du bålet\n\nGnist i tør tinder → tinderen antænder tynde tørre pinde → byg op til større brænde. Spring du tinder-trinnet over i fugtigt vejr, ender du ofte med en røgfyldt frustration. Medbragt tinder er billig forsikring mod en kold aften.\n\n## Regler først\n\nLav kun bål på anlagte bålpladser, og kun uden bålforbud — tjek altid pladsens regler og Naturstyrelsens forbudskort. Er der forbud, er et [stormkøkken](/bedste/stormkoekken) vejen til varm mad. Efterlad bålpladsen som du fandt den.\n\n## Vores anbefaling\n\nTil de fleste: et solidt Lifesystems-tændstål plus en pakke Light My Fire TinderSticks i grejposen — kombinationen der tænder bål i al slags vejr. Skal det bare være billigt og med, gør Ignite-tændstålet og Tinder-on-a-Rope jobbet til en slik.`,
    entries: [
      { product_id: "backpackerlife-374728", score: 8.6, award_label: "Bedst i test", best_for: "Pålideligt ildstål", editorial_note: "Lifesystems Fire Starter er et solidt, ergonomisk tændstål der sender en kraftig gnistbyge hver gang — robust nok til den flittige bålmager og pålideligt i vådt og blæst. Vores alround-vinder.", pros: ["Kraftig gnist", "Robust og ergonomisk", "Holder tusindvis af tændinger"], cons: ["Dyrere end nød-stål", "Kræver tinder for vådt ved"], specs: { type: "tændstål (ferrocerium)", brand: "Lifesystems" } },
      { product_id: "backpackerlife-685868", score: 8.1, award_label: "Bedst til prisen", best_for: "Begynder / backup", editorial_note: "Ignite-tændstålet er den billige vej til pålidelig gnist: gør jobbet i al slags vejr til en pris, hvor du roligt har et i hver grejpose. Perfekt første tændstål.", pros: ["Meget lav pris", "Virker i blæst og fugt", "Let at have flere af"], cons: ["Enkel konstruktion", "Mindre ergonomisk greb"], specs: { type: "tændstål (ferrocerium)", brand: "Ignite" } },
      { product_id: "backpackerlife-463212", score: 8.2, award_label: "Bedste robuste", best_for: "Hård brug", editorial_note: "Mil-Tec ildstål er det kraftige, no-nonsense militær-stål: bygget til hård brug og mange tændinger, med et solidt greb der ikke svigter med kolde fingre.", pros: ["Robust militær-kvalitet", "Godt greb", "Mange tændinger"], cons: ["Tungere end nød-stål", "Basis-finish"], specs: { type: "tændstål (ferrocerium)", brand: "Mil-Tec" } },
      { product_id: "backpackerlife-102982", score: 8.4, award_label: "Bedste optænding", best_for: "Tinder i alt vejr", editorial_note: "Light My Fire TinderSticks er fabriks-tinder, der brænder selv fugtig — split en stick op og send gnisten i. Den afgørende optænding der får bål i gang i vådt dansk vejr.", pros: ["Brænder selv fugtig", "Let at antænde", "Kompakt i grejposen"], cons: ["Forbrugsvare — løber op", "Skal medbringes"], specs: { type: "optænding/tinder", brand: "Light My Fire" } },
      { product_id: "backpackerlife-938768", score: 8.2, award_label: "Bedste nød-optænding", best_for: "Nødtinder der altid virker", editorial_note: "SOL Tinder-Quik er 12 stk vandtæt, langtidsbrændende nødtinder — små, lette og pålidelige til at have liggende permanent som backup, når alt andet er vådt.", pros: ["Vandtæt — brænder altid", "Lang brændetid pr. stk", "12 stk — rækker længe"], cons: ["Forbrugsvare", "Små at håndtere med kolde fingre"], specs: { type: "nød-tinder", brand: "SOL" } },
      { product_id: "backpackerlife-102975", score: 8.0, award_label: "Bedste budget-optænding", best_for: "Billig tinder", editorial_note: "Light My Fire Tinder-on-a-Rope er den billige, snor-monterede tinder du hænger i grejet og river en bid af, når bålet skal i gang. Mest optænding for pengene.", pros: ["Meget billig", "Nem at dosere", "Hænger klar i grejet"], cons: ["Mindre vejrbestandig end TinderSticks", "Forbrugsvare"], specs: { type: "optænding/tinder", brand: "Light My Fire" } },
    ],
  },

  // ───────────────────────── HANDSKER ─────────────────────────
  {
    slug: "handsker",
    title: "Bedste handsker til friluftsliv 2026",
    category: "handsker",
    seo_title: "Bedste handsker 2026 – fleece & vinterhandsker til shelter | ShelterDK",
    seo_description: "Find de bedste handsker til shelterture og friluftsliv. Vi scorer 6 favoritter — fleece, vinter og luffer fra Black Diamond og OMM, fra 99 til 249 kr.",
    intro: "Kolde hænder ødelægger turen hurtigere end næsten noget andet — du kan ikke knappe, pakke eller lave mad med følelsesløse fingre. Vi har scoret de bedste handsker til shelterliv og vandring: fra lette fleecehandsker til varme vinterhandsker og luffer.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Black Diamond – glove technology", url: "https://www.blackdiamondequipment.com/" },
      { title: "OutdoorGearLab – best gloves", url: "https://www.outdoorgearlab.com/topics/ski/best-gloves-and-mittens" },
    ],
    faq: [
      { q: "Handsker eller luffer — hvad er varmest?", a: "Luffer er varmest, fordi fingrene deler varme i ét rum i stedet for hver for sig — vælg dem til de koldeste forhold og stillesiddende lejrbrug. Handsker giver til gengæld fingerfærdighed, så du kan knappe, pakke og betjene udstyr. Mange tager begge: handsker til aktivitet, luffer udenpå når hænderne skal varmes." },
      { q: "Er fleecehandsker nok til danske ture?", a: "Til forår, efterår og milde vinterdage er en god fleecehandske ofte rigeligt — den isolerer, tørrer hurtigt og pakker småt. I streng kulde, blæst eller vådt vejr kommer fleece til kort; der skal du bruge en tykkere, vindafvisende eller foret handske. En tynd fleece fungerer også som inderhandske under en yderhandske." },
      { q: "Skal handsker være vandtætte?", a: "Vandtætte handsker holder hænderne tørre i regn og sne, men er mindre åndbare og tørrer langsomt indeni, hvis de først bliver våde af sved eller vand. Til aktiv vandring i mildt vejr vinder en åndbar fleece; til våd, kold lejr og vinter er en vandafvisende eller membran-handske bedre. Til de fleste 3-sæsons-ture rækker en god fleece langt." },
      { q: "Kan jeg betjene telefonen med handskerne på?", a: "Mange moderne friluftshandsker har touch-kompatible fingerspidser, så du kan bruge telefon og GPS uden at tage dem af — praktisk, når du navigerer i kulde. Tjek produktbeskrivelsen; ikke alle har det. Alternativt findes tynde inder-touchhandsker, du beholder på, mens du tager yderhandsken af." },
      { q: "Hvad gør dyrere handsker bedre?", a: "Billige fleecehandsker (under 130 kr) varmer fint på den milde tur. Mere betaler for: bedre isolering og vindafvisning, holdbart materiale i håndfladen, vandafvisning, touch-fingerspidser og en pasform der ikke glider. Mærker som Black Diamond og OMM koster mere, men holder varmen og formen sæson efter sæson." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du de rigtige handsker\n\nHænderne er blandt de første der bliver kolde — og kolde, klodsede fingre gør alt på turen sværere. De rigtige handsker er en lille udgift med stor effekt. Tre ting afgør valget: **varme vs. fingerfærdighed**, **materiale** og **vejrbestandighed**.\n\n## Handsker vs. luffer\n\n**Luffer** er varmest — fingrene deler varme i ét rum — men du mister fingerfærdighed. **Handsker** lader dig knappe, pakke og betjene udstyr. Til de koldeste, stillesiddende stunder vinder luffer; til aktivitet vinder handsker. Det varmeste system er en tynd inderhandske + en luffe udenpå.\n\n## Materiale og lag\n\n- **Fleece:** let, hurtigtørrende og varmt for vægten — det alsidige 3-sæsons-valg, og en fin inderhandske.\n- **Isoleret/foret:** tykkere fyld til streng kulde og stillesiddende lejrbrug.\n- **Vindafvisende/membran:** holder blæst og vådt ude — til de hårde, kolde dage.\n\n## Vejrbestandighed\n\nVandtætte handsker holder regn og sne ude, men er mindre åndbare og tørrer langsomt indeni. Til aktiv vandring i mildt vejr vinder en åndbar fleece; til våd, kold lejr er en vandafvisende handske bedre. Til de fleste 3-sæsons-ture rækker en god fleece langt.\n\n## Pasform og detaljer\n\nVælg en pasform der ikke glider, og se efter touch-kompatible fingerspidser, hvis du vil bruge telefon/GPS i kulden. Et holdbart materiale i håndfladen forlænger levetiden, når du håndterer brænde, reb og grej.\n\n## Vores anbefaling\n\nTil de fleste: Black Diamond Everyday Fleece — varm, holdbar og touch-kompatibel til en fornuftig pris. Skal det bare være billigt, gør en simpel fleecehandske jobbet i skuldersæsonen. Til streng kulde, så vælg en tykkere handske eller OMM Core Mitts-luffer — og overvej altid et tyndt inderlag.`,
    entries: [
      { product_id: "backpackerlife-487277", score: 8.6, award_label: "Bedst i test", best_for: "Alround fleecehandske", editorial_note: "Black Diamond Everyday Fleece er den alsidige vinder: varm, holdbar fleece med godt greb og touch-kompatible fingerspidser, så telefonen kan blive i lommen. Vores favorit til 3-sæsons shelterbrug.", pros: ["Varm, holdbar fleece", "Touch-kompatible fingre", "Godt greb i håndfladen"], cons: ["Ikke vandtæt", "Mindre til streng kulde alene"], specs: { type: "fleecehandske", brand: "Black Diamond" } },
      { product_id: "backpackerlife-48518", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget / inderhandske", editorial_note: "En simpel fleecehandske er den billige basis: varmer fint på den milde tur og fungerer som inderhandske under en yderhandske i kulde. Køb to par.", pros: ["Lav pris", "Let og hurtigtørrende", "God som inderlag"], cons: ["Basis-isolering", "Ingen vindafvisning"], specs: { type: "fleecehandske", brand: "generisk" } },
      { product_id: "backpackerlife-80005", score: 8.4, award_label: "Bedste til kulde", best_for: "Kolde vinterdage", editorial_note: "Black Diamond Mont Blanc er den varmere vinterhandske: mere isolering og vindafvisning til de kolde dage, hvor en ren fleece kommer til kort — uden at miste alt greb.", pros: ["Varm og vindafvisende", "Holdbar BD-kvalitet", "Godt greb i kulde"], cons: ["Mindre fingerfærdighed", "Højere pris"], specs: { type: "vinterhandske", brand: "Black Diamond" } },
      { product_id: "backpackerlife-291105", score: 8.3, award_label: "Bedste aktive", best_for: "Vandring & løb", editorial_note: "OMM Fusion Gloves er den lette, aktive handske fra et stærkt fjeld-/løbemærke: åndbar og tætsiddende til høj puls i kulde, uden at koge hænderne. Til dig der bevæger dig.", pros: ["Let og åndbar", "Tætsiddende aktiv pasform", "Kvalitetsmærke (OMM)"], cons: ["Mindre varm i ro", "Smal pasform"], specs: { type: "aktiv handske", brand: "OMM" } },
      { product_id: "backpackerlife-291120", score: 8.3, award_label: "Bedste luffer", best_for: "Maksimal varme", editorial_note: "OMM Core Mitts er luffen til når det virkelig er koldt: fingrene deler varme i ét rum for maksimal isolering, let nok til at trække udenpå en inderhandske. Varmest i testen.", pros: ["Varmest — luffe-konstruktion", "Let at trække over inderhandske", "OMM-kvalitet"], cons: ["Ingen fingerfærdighed", "Specialiseret brug"], specs: { type: "luffe", brand: "OMM" } },
      { product_id: "backpackerlife-48538", score: 8.1, award_label: "Bedste robuste", best_for: "Lejrarbejde", editorial_note: "Highlander Mountain er den robuste, foret handske til lejrarbejde: håndtér brænde, reb og grej uden at fryse, til en pris hvor lidt slid ikke gør ondt.", pros: ["Robust og foret", "God til lejrarbejde", "Fornuftig pris"], cons: ["Tungere og mindre fingerfærdig", "Basis-pasform"], specs: { type: "foret handske", brand: "Highlander" } },
    ],
  },

  // ───────────────────────────── HUE ─────────────────────────────
  {
    slug: "hue",
    title: "Bedste hue til friluftsliv 2026",
    category: "hue",
    seo_title: "Bedste hue 2026 – varm outdoor-hue til shelter & vandring | ShelterDK",
    seo_description: "Find den bedste hue til shelterture og friluftsliv. Vi scorer 5 favoritter — fleece, Thinsulate og foret, fra 79 til 149 kr. Hold på varmen om natten.",
    intro: "Du taber meget varme gennem hovedet — og en god hue er den billigste, letteste opgradering til en varm nat i shelteret. Vi har scoret de bedste outdoor-huer: fra lette fleecehuer til varme, forede modeller, du også kan sove i.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best winter hats", url: "https://www.outdoorgearlab.com/" },
    ],
    faq: [
      { q: "Hvorfor er en hue så vigtig på sheltertur?", a: "Hovedet og halsen afgiver meget kropsvarme, især når du ligger stille om natten. En hue er derfor en af de mest effektive måder at holde på varmen for vægten — og en tør sovehue kan være forskellen mellem en kold og en lun nat i soveposen. Den fylder og vejer næsten intet, så den bør altid være med." },
      { q: "Kan jeg sove i hue?", a: "Ja — det er faktisk en af de bedste fidusser til en varm nat i shelteret. En blød, ikke for stram hue (fleece eller tynd uld/akryl) holder hovedet varmt i soveposen, hvor selv en god pose ofte ikke dækker hovedet helt. Pak gerne en tør hue du KUN sover i, ligesom med sovesokker." },
      { q: "Fleece, uld eller akryl?", a: "Fleece er let, varmt for vægten, hurtigtørrende og blødt — det alsidige valg. Uld (eller uldblanding) holder varmen selv fugtig og lugter mindre, men koster mere. Akryl/strik er billigt og varmt, men tørrer langsommere. Til aktiv brug og sovehue vinder fleece; til den klassiske, lune strikhue er uld/akryl fint." },
      { q: "Med eller uden kvast (bobble)?", a: "Kvasten er mest stil — den gør hverken fra eller til på varmen. En hue uden kvast er til gengæld nemmere at sove i og at have hætten på over. Vælg efter smag: kvast til den klassiske vinterlook, glat hue til praktisk sove- og lagbrug under en jakkehætte." },
      { q: "Hvor varm en hue skal jeg vælge?", a: "Til 3-sæsons shelterbrug er en mellemtyk fleece- eller strikhue det alsidige valg — varm nok til kølige nætter, ikke så tyk at du sveder under aktivitet. Til vinter og stillesiddende kulde, så vælg en tykkere, foret model. En tynd hue kan også bæres under hætten som ekstra lag på de koldeste dage." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige hue\n\nEn hue er det mest oversete stykke varme-grej: lille, let og billig, men en af de mest effektive måder at holde på kropsvarmen — for du taber meget varme gennem hovedet, især når du ligger stille om natten. Til shelterbrug er huen dobbelt vigtig: dagligt lag om dagen og sovehue om natten.\n\n## Materiale\n\n- **Fleece:** let, varmt for vægten, hurtigtørrende og blødt. Det alsidige valg og en god sovehue.\n- **Uld/uldblanding:** holder varmen selv fugtig, lugter mindre — men dyrere.\n- **Akryl/strik:** billigt og varmt, den klassiske lune strikhue; tørrer lidt langsommere.\n\n## Sov i din hue\n\nEn af de bedste fidusser til en varm nat: sov med en blød, ikke for stram hue. Soveposen dækker sjældent hovedet helt, og en sovehue lukker det varmetab. Pak gerne en tør hue du KUN sover i — ligesom tørre sovesokker.\n\n## Varme og lag\n\nTil 3-sæsons shelterbrug er en mellemtyk fleece- eller strikhue det alsidige valg. Til vinter og stillesiddende kulde, så vælg en tykkere, foret model. En tynd hue kan også bæres under jakkens hætte som ekstra lag på de koldeste dage.\n\n## Kvast eller ej\n\nKvasten er stil, ikke varme. En glat hue er nemmere at sove i og at have hætten på over; en kvast-hue er den klassiske vinterlook. Vælg efter smag.\n\n## Vores anbefaling\n\nTil de fleste: en mellemtyk Mountain-hue der både fungerer som dagligt lag og sovehue. Skal det bare være billigt og varmt, gør en Thinsulate- eller fleecehue jobbet. Til vinter, så vælg en tykkere foret model — og pak altid en ekstra tør hue til natten.`,
    entries: [
      { product_id: "backpackerlife-97916", score: 8.5, award_label: "Bedst i test", best_for: "Alround dag & nat", editorial_note: "Mountain-huen rammer sweet-spottet: mellemtyk, varm og blød nok til at sove i, men ikke så tyk at du sveder under gang. Den alsidige sheltervinder til både dag og nat.", pros: ["Alsidig mellemtyk varme", "Blød — god sovehue", "Klassisk pasform"], cons: ["Ikke til streng vinter alene", "Enkelt design"], specs: { type: "strikhue", brand: "Mountain" } },
      { product_id: "backpackerlife-41661", score: 8.1, award_label: "Bedst til prisen", best_for: "Budget-varme", editorial_note: "Thinsulate-huen er den billige, varme basis: Thinsulate-foret for ekstra isolering til en pris, hvor du roligt har en i hver jakkelomme. Mest varme for pengene.", pros: ["Lav pris", "Thinsulate-isolering", "Let at have flere af"], cons: ["Basis-finish", "Tyndere end vinterhue"], specs: { type: "foret hue", brand: "generisk" } },
      { product_id: "backpackerlife-527233", score: 8.2, award_label: "Bedste fleece", best_for: "Aktiv & sovehue", editorial_note: "Fleecehuen er den lette, hurtigtørrende mulighed: blød mod panden, varm for vægten og perfekt som sovehue eller under hætten. Pakker ned til intet.", pros: ["Let og hurtigtørrende", "Blød — god at sove i", "Pakker småt"], cons: ["Mindre vindafvisende", "Tyndere varme"], specs: { type: "fleecehue", brand: "generisk" } },
      { product_id: "backpackerlife-51282", score: 8.3, award_label: "Bedste forede", best_for: "Vinter & kulde", editorial_note: "Beira Lined Bobble Hat er den varmere, forede vinterhue: ekstra isolering til de kolde dage og stillesiddende lejr, med klassisk kvast-look. Til når det virkelig er koldt.", pros: ["Foret — ekstra varm", "God til vinter", "Klassisk look"], cons: ["For varm til aktivitet", "Kvast for nogle"], specs: { type: "foret strikhue", brand: "Beira" } },
      { product_id: "backpackerlife-100531", score: 8.0, award_label: "Bedste med kvast", best_for: "Klassisk vinterlook", editorial_note: "Trespass Kellisa er den klassiske kvast-hue: lun strik og vinterlook til en venlig pris — den hyggelige hue til bålet og byturen lige så vel som shelteret.", pros: ["Lun strik", "Klassisk kvast-look", "Fornuftig pris"], cons: ["Kvast ikke til alle", "Standard varme"], specs: { type: "strikhue m. kvast", brand: "Trespass" } },
    ],
  },

  // ─────────────────────── SIDDEUNDERLAG ───────────────────────
  {
    slug: "siddeunderlag",
    title: "Bedste siddeunderlag 2026",
    category: "siddeunderlag",
    seo_title: "Bedste siddeunderlag 2026 – sit pad til shelter & pause | ShelterDK",
    seo_description: "Find det bedste siddeunderlag til shelterture og pauser. Vi scorer 5 favoritter — foldbar, oppustelig og selvoppustelig, fra Highlander til Nordisk, 59 til 299 kr.",
    intro: "Et siddeunderlag er det lille stykke grej, der holder bagdelen tør og varm — på den våde træstub, den kolde sten eller bænken ved shelteret. Vi har scoret de bedste sit pads: fra lette foldbare skumplader til polstrede selvoppustelige, der gør pausen til en fornøjelse.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Sea to Summit – sit pads & mats", url: "https://seatosummit.com/" },
      { title: "Nordisk – outdoor equipment", url: "https://nordisk.eu/" },
    ],
    faq: [
      { q: "Har jeg virkelig brug for et siddeunderlag?", a: "Det er luksus du hurtigt ikke vil undvære. En kold, våd siddeplads trækker varme ud af kroppen og gør pauser ufrivilligt korte. Et siddeunderlag vejer næsten intet, koster lidt, og holder bagdelen tør og varm — på træstubben, stenen, det fugtige græs eller shelterets bænk. Især om vinteren og på våde dage gør det en stor forskel." },
      { q: "Foldbar skumplade eller oppustelig?", a: "En foldbar skumplade er let, billig, vedligeholdelsesfri og kan ikke punktere — den er altid klar og tåler alt. En oppustelig eller selvoppustelig pude er mere polstret og komfortabel og pakker mindre, men kan i princippet punktere og koster mere. Til robust, sorgløs brug vinder skum; til maksimal komfort vinder den oppustelige." },
      { q: "Kan jeg bruge siddeunderlaget til andet?", a: "Ja — det er et alsidigt stykke grej. Det fungerer som knæpude under madlavning, som isolerende plade under fødderne eller ryggen i shelteret, og en skumplade kan endda forlænge et kort liggeunderlag ved at lægge den under benene. Mange bruger det også som lille lejr-sæde at sætte sig på hvor som helst." },
      { q: "Hvad betyder selvoppustelig?", a: "Et selvoppusteligt underlag har et åbent skum indeni: når du åbner ventilen, suger skummet selv luft ind og puster sig op, og du justerer komforten ved at puste lidt ekstra i. Det giver mere polstring end en ren skumplade og mindre besvær end at puste en luftpude helt op. Luk ventilen, så holder det formen mens du sidder." },
      { q: "Hvor meget vejer et siddeunderlag?", a: "Foldbare skumplader vejer typisk 50-150 g — du mærker dem knap i rygsækken. Selvoppustelige og polstrede modeller vejer lidt mere (150-300 g), men er stadig lette nok til enhver tur. Vægten er sjældent et argument mod et siddeunderlag; det er et af de billigste komfort-løft pr. gram, du kan pakke." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige siddeunderlag\n\nEt siddeunderlag (sit pad) løser et lille men reelt problem: kolde, våde siddepladser, der gør pauser korte og trækker varme ud af kroppen. For næsten ingen vægt og en lille pris holder det bagdelen tør og varm — på stubben, stenen, det fugtige græs eller shelterets bænk. To valg afgør resten: **konstruktion** og **komfort vs. robusthed**.\n\n## Skum vs. oppustelig\n\n- **Foldbar skumplade:** let, billig, vedligeholdelsesfri og kan ikke punktere. Altid klar, tåler alt — det robuste, sorgløse valg.\n- **Oppustelig pude:** mere polstret og pakker mindre, men kan punktere og koster mere.\n- **Selvoppustelig:** åbent skum der selv suger luft ind — mere komfort end ren skum, mindre besvær end en luftpude. Justér med et ekstra pust.\n\n## Komfort vs. robusthed\n\nGår du hårdt til grejet og vil have noget der bare virker, så vælg en skumplade. Vil du sidde blødt og længe — fx på en lang pause eller en kold dag — så er en selvoppustelig eller polstret model pengene værd. Mange har en billig skumplade som standard og opgraderer, hvis de sidder meget.\n\n## Alsidig brug\n\nEt siddeunderlag er mere end en sæde-plade: knæpude under madlavning, isolering under fødder eller ryg i shelteret, og en skumplade kan forlænge et kort liggeunderlag under benene. Lille grej, mange funktioner.\n\n## Vægt\n\nSkumplader vejer 50-150 g, selvoppustelige 150-300 g — alt sammen let nok til enhver tur. Vægten er sjældent et argument imod; det er et af de billigste komfort-løft pr. gram, du kan pakke.\n\n## Vores anbefaling\n\nTil de fleste: Sea to Summit Delta V Seat — selvoppustelig, polstret komfort der gør pausen til en fornøjelse. Skal det bare være let, billigt og uopsletteligt, så vælg en foldbar skumplade. Til premium-komfort er Nordisk Alden toppen.`,
    entries: [
      { product_id: "backpackerlife-124354", score: 8.6, award_label: "Bedst i test", best_for: "Polstret komfort", editorial_note: "Sea to Summit Delta V Seat er selvoppustelig, polstret komfort i et kompakt format: åbn ventilen, og du har en blød, isolerende siddeplade på sekunder. Vores favorit til den, der sidder meget.", pros: ["Selvoppustelig — blød komfort", "Isolerer godt mod kulde", "Pakker kompakt"], cons: ["Kan i princippet punktere", "Dyrere end skum"], specs: { type: "selvoppustelig sit pad", brand: "Sea to Summit" } },
      { product_id: "backpackerlife-722410", score: 8.2, award_label: "Bedst til prisen", best_for: "Robust & sorgløs", editorial_note: "Den foldbare, vandafvisende skumplade er det billige, uopslidelige basisvalg: kan ikke punktere, tåler alt og er altid klar. Mest siddeunderlag for pengene.", pros: ["Meget lav pris", "Kan ikke punktere", "Altid klar — tåler alt"], cons: ["Mindre polstring", "Fylder lidt foldet"], specs: { type: "foldbar skumplade", brand: "generisk" } },
      { product_id: "backpackerlife-259110", score: 8.3, award_label: "Bedste pakmål", best_for: "Letvægt-pakkere", editorial_note: "Highlander Pak-Pad Air er den oppustelige sit pad, der pakker ned til lommestørrelse: blød at sidde på, men fylder næsten intet i rygsækken. Til dig der tæller plads.", pros: ["Pakker mikroskopisk", "Blød oppustelig komfort", "Meget let"], cons: ["Kan punktere", "Skal pustes op"], specs: { type: "oppustelig sit pad", brand: "Highlander" } },
      { product_id: "backpackerlife-61804", score: 8.0, award_label: "Bedste budget-oppustelige", best_for: "Blød siddeplads billigt", editorial_note: "Det oppustelige siddeunderlag er den billige vej til blød siddekomfort: pust op til ønsket fasthed, og pak det fladt sammen igen. Komfort uden den store regning.", pros: ["Blød oppustelig komfort", "Lav pris", "Pakker fladt"], cons: ["Kan punktere", "Basis-materiale"], specs: { type: "oppustelig sit pad", brand: "generisk" } },
      { product_id: "backpackerlife-629287", score: 8.4, award_label: "Bedste premium", best_for: "Maksimal komfort", editorial_note: "Nordisk Alden 3,8 er premium-siddeunderlaget: tyk, polstret komfort fra et anerkendt skandinavisk mærke — toppen for den, der prioriterer en blød, varm siddeplads over alt andet.", pros: ["Tyk, polstret komfort", "Anerkendt Nordisk-kvalitet", "God isolering"], cons: ["Højeste pris", "Fylder og vejer mest"], specs: { type: "polstret sit pad", brand: "Nordisk" } },
    ],
  },
];

async function req(method, path, body, extraHeaders = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers: { ...H, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function upsertGuide(g) {
  const { entries, ...guideRow } = g;
  guideRow.status = "published";
  guideRow.author = AUTHOR;
  const [row] = await req("POST", "buying_guides?on_conflict=slug", guideRow, { Prefer: "resolution=merge-duplicates,return=representation" });
  const guideId = row.id;
  await req("DELETE", `buying_guide_entries?guide_id=eq.${guideId}`);
  let rank = 0;
  for (const e of entries) {
    await req("POST", "buying_guide_entries?on_conflict=guide_id,affiliate_product_id", {
      guide_id: guideId, affiliate_product_id: e.product_id, rank: rank++,
      award_label: e.award_label ?? null, editorial_note: e.editorial_note ?? null,
      pros: e.pros ?? [], cons: e.cons ?? [], score: e.score ?? null, best_for: e.best_for ?? null,
    }, { Prefer: "resolution=merge-duplicates" });
    if (e.specs) await req("PATCH", `affiliate_products?id=eq.${encodeURIComponent(e.product_id)}`, { specs: e.specs });
  }
  return { slug: g.slug, entries: entries.length };
}

(async () => {
  for (const g of guides) {
    try { const res = await upsertGuide(g); console.log(`✓ ${res.slug} (${res.entries} produkter) → /bedste/${res.slug}`); }
    catch (err) { console.error(`✗ ${g.slug}: ${err.message}`); }
  }
  console.log("\nFærdig (v7). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
