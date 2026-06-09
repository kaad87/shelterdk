// Seed buyer-intent købsguider (v2) på shelterdk.
// Idempotent: upsert på slug (guider) og guide_id+affiliate_product_id (entries).
// v2: scores (0-10), best_for, author; reselekteret mod konverterende mellemklasse.
// Live pris/lager hentes ved render. Kør: node seed_buying_guides.mjs
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
  {
    slug: "sovepose",
    title: "Bedste sovepose 2026",
    category: "sovepose",
    seo_title: "Bedste sovepose 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste sovepose til shelter og friluftsliv. Vi scorer 8 favoritter fra budget til premium — dun vs. syntetisk, temperatur og vægt.",
    intro: "Vi har scoret de bedste soveposer til shelter- og friluftsovernatning i Danmark — med fokus på det der faktisk holder dig varm til prisen, ikke kun de dyreste ekspeditionsposer.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "EN/ISO 23537 – temperatur-ratings forklaret", url: "https://en.wikipedia.org/wiki/EN_13537" },
      { title: "OutdoorGearLab – best sleeping bags", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-sleeping-bag" },
    ],
    faq: [
      { q: "Dun eller syntetisk sovepose?", a: "Syntetisk isolerer selv når den er fugtig, tørrer hurtigt og er billigere — et trygt valg i fugtigt dansk klima og til begyndere. Dun pakker mindst og vejer mindst, men koster mere og skal holdes tør. Til de fleste shelterture er en god syntetpose i mellemklassen det rigtige." },
      { q: "Hvor varm skal en sovepose være til shelter i Danmark?", a: "Til forår/efterår i et åbent shelter: sigt efter komforttemperatur 0 til -5 °C, så du har margin. Om sommeren rækker komfort omkring 8-10 °C. Temperatur-tal er vejledende — sov med tøj og hue hvis du fryser let." },
      { q: "Komfort- vs. grænsetemperatur?", a: "Komforttemperatur er hvor en gennemsnitlig person sover godt; grænsetemperatur er hvor man lige kan sove sammenrullet uden at fryse. Vælg ud fra komforttemperaturen." },
      { q: "Hvad koster en god sovepose?", a: "Du får en udmærket 3-sæsons sovepose til 500-1.000 kr. Over ~1.500 kr betaler du primært for lavere vægt og bedre dun. Under 400 kr er fint til sommer og begyndere." },
      { q: "Skal jeg bruge liggeunderlag under soveposen?", a: "Ja — det meste kuldetab sker nedad mod jorden. Et liggeunderlag med passende R-værdi er lige så vigtigt som selve posen." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige sovepose\n\nTre ting afgør valget: **temperatur**, **isolering** og **vægt/pakmål**. Til shelterture det meste af året i Danmark er en 3-sæsons pose med komfort omkring 0 °C det mest alsidige — og du behøver ikke betale i dyre domener for at få den.\n\n## Dun eller syntetisk\n\n**Syntetisk** isolerer stadig når den er fugtig, tørrer hurtigt og koster mindre — trygt i dansk klima. **Dun** giver mest varme for vægten og pakker mindst, men koster mere og mister isolering hvis den bliver våd. Vægtbevidste vandrere vælger dun; alle andre er godt tjent med en kvalitets-syntetpose.\n\n## Form og pasform\n\nEn **mumie-model** isolerer bedst, mens en rektangulær giver mere plads. Vælg den rigtige længde — tomt rum i posen er koldluft du selv skal varme op.\n\n## Typiske købsfejl\n\nAt vælge efter grænsetemperatur i stedet for komforttemperatur; at glemme liggeunderlaget; og at betale for en -20 °C-pose man aldrig bruger. Køb til den brug du faktisk har.\n\n## Vores anbefaling\n\nTil de fleste: en 3-sæsons pose med komfort omkring 0 °C i 500-1.000 kr-klassen. Skal du sove ude om vinteren, gå op i en koldere model og kombinér med et godt liggeunderlag.`,
    entries: [
      { product_id: "backpackerlife-212384", score: 9.0, award_label: "Bedst i test", best_for: "Alround 3-sæson", editorial_note: "Nordisk Puk -2 rammer sweet-spottet: pålidelig varme, fin pasform og et stærkt mærke til en pris de fleste kan være med på. Vores alround-favorit.", pros: ["Fremragende værdi", "Pålidelig 3-sæsons varme", "Anerkendt dansk brand"], cons: ["Syntetisk fylder lidt mere", "Ikke til streng vinter"], specs: { komfort_temp: -2, fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-666127", score: 8.0, award_label: "Bedst til prisen", best_for: "Stramt budget / sommer", editorial_note: "Highlander Rayet 250 er den billige vej i gang — let og fin til sommernætter og den første sheltertur.", pros: ["Meget lav pris", "Let", "Fint til sommer"], cons: ["Kun til milde nætter", "Simpel komfort"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-72781", score: 8.2, award_label: "Bedste 4-sæson value", best_for: "Alsidig hele året billigt", editorial_note: "Snugpak Travelpak 4 giver fire-sæsons alsidighed til en skarp pris — robust og pasningsfri.", pros: ["4-sæsons alsidighed", "God pris", "Robust"], cons: ["Tungere", "Større pakmål"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-152819", score: 8.4, award_label: "Bedste letvægt", best_for: "Letvægt sommer (dun)", editorial_note: "Treklife Down 300 er en overraskende billig dunpose — lav vægt og lille pakmål til sommer- og vandreture.", pros: ["Let og kompakt (dun)", "Skarp pris for dun", "God til sommer"], cons: ["Kun 2-sæson", "Skal holdes tør"], specs: { fyld: "dun", form: "mumie" } },
      { product_id: "backpackerlife-926742", score: 8.5, award_label: "Bedste komfort", best_for: "Komfortabel 3-sæson", editorial_note: "Nemo Tempo 35 er en behagelig 3-sæsons med god plads og kvalitetsfornemmelse fra et stærkt mærke.", pros: ["Behagelig pasform", "Kvalitetsmærke (Nemo)", "Solid 3-sæson"], cons: ["Mellem-høj pris", "Fylder lidt"], specs: { komfort_temp: 2, fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-613165", score: 8.6, award_label: "Bedste til vinter", best_for: "Koldt vejr / sen efterår", editorial_note: "Sea to Summit Boab -9 holder dig varm når temperaturen falder — til dig der sover ude i skuldersæsonen og vinter.", pros: ["Varm i minusgrader", "Kvalitetsbrand", "God til vinter-shelter"], cons: ["For varm om sommeren", "Tungere"], specs: { komfort_temp: -9, fyld: "syntetisk", form: "mumie" } },
      { product_id: "outmore-9327868157921", score: 8.8, award_label: "Bedste premium", best_for: "Premium dun, lav vægt", editorial_note: "Sea to Summit Trek -1c Down er premium-dun: lav vægt, lille pakmål og høj kvalitet — til den vægtbevidste der vil have det bedste.", pros: ["Premium dunkvalitet", "Lav vægt + lille pakmål", "Holdbar"], cons: ["Høj pris", "Kræver tør opbevaring"], specs: { komfort_temp: -1, fyld: "dun", form: "mumie" } },
      { product_id: "outmore-5709388147141", score: 7.8, award_label: "Bedste til begyndere", best_for: "Begynder / mild sommer", editorial_note: "Easy Camp Raven I er billig og nem — perfekt til den allerførste tur eller festivalen.", pros: ["Meget billig", "Enkel og nem", "Fin til sommer"], cons: ["Kun milde nætter", "Basal kvalitet"], specs: { komfort_temp: 5, fyld: "syntetisk", form: "mumie" } },
    ],
  },

  {
    slug: "liggeunderlag",
    title: "Bedste liggeunderlag 2026",
    category: "liggeunderlag",
    seo_title: "Bedste liggeunderlag 2026 – test og købsguide | ShelterDK",
    seo_description: "Find det bedste liggeunderlag til shelter og telt. Vi scorer 8 favoritter — R-værdi, komfort og vægt, fra budget til premium.",
    intro: "Liggeunderlaget er det mest oversete sovegrej — og det vigtigste for varmen. Vi har scoret de bedste fra billigt til premium, med vægt på værdi og isolering (R-værdi).",
    last_reviewed_at: TODAY,
    sources: [{ title: "R-værdi på liggeunderlag (ASTM F3340)", url: "https://en.wikipedia.org/wiki/Sleeping_pad" }],
    faq: [
      { q: "Hvad er R-værdi?", a: "R-værdi måler isolering mod kulde fra jorden — jo højere, jo varmere. Sommer: R 1-2. 3-sæsons: R 3-4. Vinter: R 5+." },
      { q: "Oppusteligt, selvoppustende eller skum?", a: "Oppustelige er mest komfortable og pakker småt, men kan punktere. Selvoppustende er en robust mellemvej. Skum er billigst og uopslideligt, men mindre komfortabelt." },
      { q: "Hvilket liggeunderlag til shelter?", a: "Til shelter med trægulv er R 3-4 et godt alround-valg. På kold jord eller vinter: vælg højere R-værdi." },
      { q: "Hvad koster et godt liggeunderlag?", a: "Et godt selvoppustende/oppusteligt underlag fås fra 500-900 kr. Over ~1.500 kr betaler du for lav vægt og høj R-værdi." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Det vigtigste tal: R-værdi\n\nR-værdien fortæller hvor godt underlaget isolerer mod kulde fra jorden. Sigt efter **R 3-4 til 3-sæsons** og **R 5+ til vinter**. Et tyndt skumunderlag under et oppusteligt øger samlet R-værdi og beskytter mod punktering.\n\n## Typer\n\n**Oppustelige** er mest komfortable og pakker mindst — tag en lap med. **Selvoppustende** er robust og bekvemt. **Skum** er billigst og uopslideligt, men fylder.\n\n## Komfort og vægt\n\nTykkelse betyder komfort — 5 cm+ føles markant bedre, især for sidesovere. Vægtbevidste vælger oppustelige; shelter- og campingfolk prioriterer ofte komfort over gram.\n\n## Typiske købsfejl\n\nAt vælge et tyndt sommer-underlag til kolde nætter (for lav R-værdi), og at glemme en reparationslap til oppustelige modeller.`,
    entries: [
      { product_id: "outmore-9327868067077", score: 8.8, award_label: "Bedst i test", best_for: "Alround komfort", editorial_note: "Sea to Summit Camp Mat er selvoppustende, behageligt og robust til en fornuftig pris — vores alround-favorit til shelter og camping.", pros: ["God komfort", "Selvoppustende — nemt", "Stærkt mærke til prisen"], cons: ["Fylder mere end ultralette", "Tungere"], specs: { type: "selvoppustende" } },
      { product_id: "backpackerlife-251981", score: 7.6, award_label: "Bedst til prisen", best_for: "Stramt budget", editorial_note: "Highlanders selvoppustende underlag er billigste vej til reel komfort — fint udgangspunkt.", pros: ["Lav pris", "Selvoppustende", "Nem"], cons: ["Moderat isolering", "Fylder"], specs: { type: "selvoppustende" } },
      { product_id: "backpackerlife-297425", score: 8.5, award_label: "Bedste letvægt", best_for: "Letvægt vandring", editorial_note: "Klymit Insulated V Ultralite er let, isoleret og kompakt — godt til vandrere der vil have varme uden vægt.", pros: ["Let og kompakt", "Isoleret", "God værdi"], cons: ["Kan punktere", "Lidt støjende"], specs: { type: "oppustelig", r_vaerdi: 4 } },
      { product_id: "backpackerlife-629283", score: 8.6, award_label: "Bedste til vinter", best_for: "Vinter / høj R-værdi", editorial_note: "Nordisk Alden 5.0 har høj isolering til de kolde nætter — et trygt valg til vinter-shelter.", pros: ["Høj R-værdi", "Solid komfort", "Stærkt brand"], cons: ["Overkill om sommeren", "Højere pris"], specs: { type: "oppustelig", r_vaerdi: 5 } },
      { product_id: "outmore-811666034618", score: 8.7, award_label: "Bedste premium", best_for: "Premium komfort + isolering", editorial_note: "Nemo Astro Insulated er let, tykt og varmt — premium komfort til den kræsne vandrer.", pros: ["Tyk og behagelig", "God isolering", "Lav vægt for komforten"], cons: ["Høj pris", "Oppustelig (punkteringsrisiko)"], specs: { type: "oppustelig", r_vaerdi: 4 } },
      { product_id: "outmore-9327868168439", score: 8.4, award_label: "Bedste til camping", best_for: "Maks komfort (camping)", editorial_note: "Sea to Summit Comfort Deluxe er tykt og luksuriøst — når komfort vejer tungere end gram.", pros: ["Meget komfortabel", "Robust", "Selvoppustende"], cons: ["Fylder og vejer", "Ikke til vandring"], specs: { type: "selvoppustende" } },
      { product_id: "backpackerlife-808519", score: 8.3, award_label: "Bedste value", best_for: "Isoleret 3-sæson value", editorial_note: "Treklife Insulated Comfort giver isoleret 3-sæsons komfort til en skarp pris.", pros: ["God værdi", "Isoleret", "Behagelig"], cons: ["Fylder lidt", "Basal pumpe"], specs: { type: "oppustelig", r_vaerdi: 3 } },
      { product_id: "backpackerlife-832828", score: 8.0, award_label: "Bedste til begyndere", best_for: "Bredt og billigt", editorial_note: "Treklife Ultra RV er bredt og billigt — godt til begyndere og dem der vil ligge ekstra godt.", pros: ["Billigt", "Bredt og behageligt", "Nemt"], cons: ["Tungere", "Større pakmål"], specs: { type: "oppustelig" } },
    ],
  },

  {
    slug: "pandelampe",
    title: "Bedste pandelampe 2026",
    category: "pandelampe",
    seo_title: "Bedste pandelampe 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste pandelampe til friluftsliv. Vi scorer 8 favoritter — lysstyrke, batteritid og genopladelighed, fra budget til premium.",
    intro: "En pålidelig pandelampe er uundværlig på sheltertur. Vi har scoret de bedste med fokus på lysstyrke, batteritid og værdi — ikke kun de dyreste.",
    last_reviewed_at: TODAY,
    sources: [{ title: "ANSI/PLATO FL1 – lysstyrke-standard", url: "https://en.wikipedia.org/wiki/Flashlight#Performance_standards" }],
    faq: [
      { q: "Hvor mange lumen skal en pandelampe have?", a: "Til lejr og gang rækker 200-400 lumen. Til løb eller hurtig færden i mørke: 800+ lumen. Flere lumen = kortere batteritid på højeste trin." },
      { q: "Genopladelig eller batterier?", a: "Genopladelig (USB) er billigst i drift og bedst i hverdagen. Udskiftelige batterier er en fordel på lange ture uden strøm. De mest fleksible kan begge dele." },
      { q: "Hvad er rødt lys godt for?", a: "Rødt lys bevarer nattesynet og blænder ikke teltkammeraterne — godt til at læse og bevæge sig i lejren." },
      { q: "Hvad koster en god pandelampe?", a: "En fremragende alround-lampe fås for 300-600 kr (fx Petzl Actik Core). Over ~1.000 kr betaler du for meget lys, reaktivt lys og robusthed." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Lysstyrke og rækkevidde\n\n**Lumen** måler lysmængden; rækkevidde hvor langt lyset når. Lejr/gang: 200-400 lumen. Løb/sti: 800+ lumen. Husk at højeste trin dræner batteriet hurtigt.\n\n## Batteri\n\nGenopladelige (USB) er nemmest og billigst i hverdagen. Til lange ture uden strøm er udskiftelige batterier en fordel — de mest fleksible lamper kan begge dele. Tjek batteritid på et **realistisk** lystrin.\n\n## Komfort og features\n\nGodt hovedbånd, lav vægt og en **rødlys-tilstand** gør stor forskel. Til dansk vejr bør lampen tåle regn — kig efter mindst IPX4.\n\n## Typiske købsfejl\n\nAt jagte maksimale lumen man aldrig bruger (og ofre batteritid), og at vælge en lampe uden rødt lys til delt shelter/telt.`,
    entries: [
      { product_id: "outmore-3342540846388", score: 9.2, award_label: "Bedst i test", best_for: "Alround friluft", editorial_note: "Petzl Actik Core er referencen: rigeligt lys, genopladelig (men kan også køre på AAA), rødt lys og pålidelig kvalitet — til en pris de fleste kan være med på.", pros: ["Genopladelig + AAA-fleksibilitet", "Rødt lys + godt hovedbånd", "Pålidelig Petzl-kvalitet"], cons: ["Ikke den kraftigste", "Mellemklasse-pris"], specs: { lumen: 600, genopladelig: true } },
      { product_id: "outmore-3342540847187", score: 8.2, award_label: "Bedst til prisen", best_for: "Billig pålidelig", editorial_note: "Petzl Tikka er den billige, pålidelige klassiker — mere end nok til lejr og gang.", pros: ["Lav pris", "Pålidelig", "Let"], cons: ["AAA-batterier", "Lavere lysstyrke"], specs: { lumen: 350, genopladelig: false } },
      { product_id: "outmore-3342540840980", score: 8.9, award_label: "Bedste premium", best_for: "Kraftig / reaktiv", editorial_note: "Petzl Swift RL har reaktivt lys der automatisk justerer styrken — kraftig og smart til krævende ture.", pros: ["Kraftigt + reaktivt lys", "Genopladelig", "Premium kvalitet"], cons: ["Høj pris", "Tungere"], specs: { lumen: 1100, genopladelig: true } },
      { product_id: "outmore-7318860208713", score: 7.8, award_label: "Bedste budget genopladelig", best_for: "Billigst genopladelig", editorial_note: "Silva Seek 420 er en billig genopladelig indgang med fin lysstyrke til lejr.", pros: ["Billig + genopladelig", "Fin til lejr", "Let"], cons: ["Basal", "Kortere rækkevidde"], specs: { lumen: 420, genopladelig: true } },
      { product_id: "outmore-6957713004297", score: 8.5, award_label: "Bedste kraftige value", best_for: "Kraftigt nærlys", editorial_note: "Armytek Wizard C2 Pro Max giver masser af flomlys for pengene — robust og vandtæt.", pros: ["Meget lys for pengen", "Robust + vandtæt", "Genopladelig"], cons: ["Tungere", "Mere lommelygte-følelse"], specs: { lumen: 3800, genopladelig: true } },
      { product_id: "outmore-4058205010313", score: 8.1, award_label: "Bedste til arbejde", best_for: "Robust arbejds-/friluftsbrug", editorial_note: "Ledlenser IH8R er robust med jævnt, behageligt lys — til dig der bruger lampen hårdt.", pros: ["Robust bygning", "Jævnt lys", "Genopladelig"], cons: ["Lidt tung", "Mere arbejdsfokus"], specs: { lumen: 600, genopladelig: true } },
      { product_id: "outmore-793661588627", score: 8.6, award_label: "Bedste til trail", best_for: "Maks lys / trail", editorial_note: "Black Diamond Distance 1500 leverer kraftigt, langt lys til løb og hurtig færden i mørke.", pros: ["Meget kraftigt lys", "God rækkevidde", "Genopladelig"], cons: ["Højere pris", "Eksternt batteri"], specs: { lumen: 1500, genopladelig: true } },
      { product_id: "outmore-7318860207693", score: 7.9, award_label: "Bedste kompakt", best_for: "Ultrakompakt backup", editorial_note: "Silva Smini er lillebitte og let — perfekt som backup eller til den vægtbevidste.", pros: ["Meget lille og let", "Genopladelig", "Fin backup"], cons: ["Lav lysstyrke", "Kort rækkevidde"], specs: { genopladelig: true } },
    ],
  },

  {
    slug: "telt",
    title: "Bedste telt 2026",
    category: "telt",
    seo_title: "Bedste telt 2026 – test og købsguide | ShelterDK",
    seo_description: "Find det bedste telt til friluftsliv. Vi scorer 8 favoritter fra budget til premium — 1-4 personer, letvægt og familie.",
    intro: "Vi har scoret de bedste telte til friluftsliv i Danmark — fra et billigt 2-personers til robuste familie- og letvægtstelte. Fokus på værdi og brugbarhed, ikke kun de dyreste.",
    last_reviewed_at: TODAY,
    sources: [{ title: "Teltsæsoner og opbygning forklaret", url: "https://en.wikipedia.org/wiki/Tent" }],
    faq: [
      { q: "Hvor mange sæsoner skal teltet kunne?", a: "3-sæsons dækker forår/sommer/efterår og er nok for de fleste. 4-sæsons tåler sne og kraftig vind, men er tungere og dyrere." },
      { q: "Hvor mange personer skal teltet rumme?", a: "Personangivelsen er ofte stram — vil du have plads til grej og bevægelse, vælg ét persontal op." },
      { q: "Hvad koster et godt telt?", a: "Et solidt 2-personers fås fra 700-1.300 kr. Letvægts- og 4-sæsons-telte koster mere. Under 600 kr er fint til festival og milde forhold." },
      { q: "Skal jeg bruge en footprint?", a: "En footprint beskytter bunden mod slid og fugt og forlænger teltets levetid — billig forsikring på stenet/fugtigt underlag." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Vælg teltet efter brugen\n\nSkal det bæres på vandretur, eller stå på en fast lejrplads? **Vægt og pakmål** afgør om teltet egner sig til at bære; **plads og ståhøjde** betyder mest når du bliver længe samme sted.\n\n## Sæson og robusthed\n\n**3-sæsons** dækker det meste af året i Danmark. Skal teltet stå imod sne og kraftig vind, vælg et **4-sæsons** med flere stænger og kraftigere dug.\n\n## Personantal\n\nProducenternes persontal er optimistiske. To voksne med grej har det godt i et "3-personers". Vælg op hvis du vil have albuerum.\n\n## Typiske købsfejl\n\nAt købe efter persontal i stedet for reel plads, og at glemme footprint på stenet underlag.`,
    entries: [
      { product_id: "backpackerlife-64353", score: 8.6, award_label: "Bedst i test", best_for: "Alround 2-personers", editorial_note: "Highlander Blackthorn 2 er den klassiske, prisvenlige 2-personers backpacking-telt — solid og nem til de fleste shelter-/vandreture.", pros: ["Fremragende værdi", "Nem at slå op", "Fint pakmål for prisen"], cons: ["Ikke ultralet", "Basal ventilation"], specs: { personer: 2, saeson: "3-sæsons" } },
      { product_id: "outdoortid-52096196116812", score: 7.8, award_label: "Bedst til prisen", best_for: "Billigst 2-personers", editorial_note: "Nordic Peak Pico 2.0 er billigste vej til et rigtigt 2-personers telt — fint til milde forhold og begyndere.", pros: ["Meget lav pris", "Let nok", "Fin til sommer"], cons: ["Ikke til hårdt vejr", "Simpel kvalitet"], specs: { personer: 2, saeson: "2-3-sæsons" } },
      { product_id: "backpackerlife-41621", score: 8.2, award_label: "Bedste solo", best_for: "Solo letvægt", editorial_note: "Highlander Blackthorn 1 er et kompakt, billigt 1-personers — godt til soloture med lav vægt.", pros: ["Let og kompakt", "God pris", "Hurtig opsætning"], cons: ["Snæver plads", "Lidt kondens"], specs: { personer: 1, saeson: "3-sæsons" } },
      { product_id: "backpackerlife-741484", score: 8.0, award_label: "Bedste til lille familie", best_for: "3 personer / value", editorial_note: "High Peak Nevada 3 giver familieplads til en skarp pris — godt til weekendture med børn.", pros: ["God plads for prisen", "Nem", "Fint til 3"], cons: ["Tungere", "Basal materialekvalitet"], specs: { personer: 3, saeson: "3-sæsons" } },
      { product_id: "backpackerlife-95676", score: 8.3, award_label: "Bedste letvægt", best_for: "Letvægt 2-personers", editorial_note: "High Peak Kite LW er et letvægts 2-personers til den der vil bære mindre på vandreturen.", pros: ["Lav vægt", "Lille pakmål", "2-personers"], cons: ["Mindre plads", "Højere pris end basis"], specs: { personer: 2, saeson: "3-sæsons" } },
      { product_id: "outmore-5709388144911", score: 8.5, award_label: "Bedste premium", best_for: "Robust til længere ture", editorial_note: "Robens Lodge 2 Exp er et robust, gennemtænkt 2-personers til længere og mere krævende ture.", pros: ["Robust kvalitet", "God ventilation", "Holdbar"], cons: ["Højere pris", "Tungere"], specs: { personer: 2, saeson: "3-4-sæsons" } },
      { product_id: "outmore-5709388144836", score: 8.1, award_label: "Bedste familie", best_for: "4 personer / camping", editorial_note: "Easy Camp Hidra 4 er et rummeligt familietelt til campingpladsen og længere ophold.", pros: ["God familieplads", "Ståhøjde", "Nem"], cons: ["Tungt", "Til camping, ikke vandring"], specs: { personer: 4, saeson: "3-sæsons" } },
      { product_id: "outdoortid-53030432964940", score: 8.0, award_label: "Bedste tipi", best_for: "Tipi / brændeovn", editorial_note: "Naturehike Ranch 4.0 er et tipi-telt med god ståhøjde og plads — hyggeligt til længere ophold og koldt vejr.", pros: ["Stor ståhøjde", "God plads", "Tipi-hygge"], cons: ["Pakker stort", "Ingen bund i nogle versioner"], specs: { personer: 4, saeson: "3-4-sæsons" } },
    ],
  },

  {
    slug: "vandfilter",
    title: "Bedste vandfilter 2026",
    category: "vandfilter",
    seo_title: "Bedste vandfilter 2026 – test og købsguide | ShelterDK",
    seo_description: "Find det bedste vandfilter til vandretur og shelter. Vi scorer favoritter — LifeStraw, Katadyn og kemisk rensning, fra budget til gruppe.",
    intro: "Rent vand er afgørende på tur. Vi har scoret de bedste vandfiltre og renseløsninger til dansk friluftsliv — fra billige nødfiltre til hurtige squeeze-filtre og gruppeløsninger.",
    last_reviewed_at: TODAY,
    sources: [{ title: "CDC – water treatment når du er ude", url: "https://wwwnc.cdc.gov/travel/page/water-disinfection" }],
    faq: [
      { q: "Skal man filtrere vand i Danmark?", a: "Postevand er sikkert, men vand fra søer, åer og ukendte kilder bør altid renses. Selv klart vand kan indeholde bakterier og parasitter. Tag et filter eller rensetabletter med på tur." },
      { q: "Filter eller kemisk rensning?", a: "Et filter giver rent vand med det samme og fjerner bakterier og parasitter. Kemisk rensning (tabletter) fylder intet og er god backup, men tager tid og fjerner ikke alt. Mange tager begge dele." },
      { q: "Fjerner vandfiltre virus?", a: "De fleste lommefiltre fjerner bakterier og parasitter, men IKKE virus. I Danmark/Norden er virus sjældent et problem i naturen; på rejser uden for Europa bør du supplere med kemisk rensning eller UV." },
      { q: "Hvad koster et godt vandfilter?", a: "Et fremragende squeeze-filter fås for 250-500 kr. Gravitations-/gruppeløsninger koster mere. Rensetabletter er billigst og fin backup." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Filter, gravitation eller kemi?\n\n**Lommefiltre/squeeze** (fx Katadyn BeFree, LifeStraw) er hurtige og giver rent vand med det samme — bedst til de fleste. **Gravitationsfiltre** er gode til grupper og basecamp. **Kemisk rensning** (tabletter) fylder intet og er perfekt backup.\n\n## Hvad fjerner de?\n\nDe fleste filtre fjerner **bakterier og parasitter** (E. coli, giardia, cryptosporidium). De fjerner normalt ikke virus — sjældent et problem i Norden, men relevant på fjernrejser.\n\n## Vedligehold\n\nSkyl filteret efter brug, lad det tørre, og undgå frost (kan ødelægge membranen). Et tilstoppet filter får langsommere flow — back-flush det som anvist.\n\n## Typiske købsfejl\n\nAt stole på et filter mod virus på fjernrejser, og at lade filteret fryse om vinteren.`,
    entries: [
      { product_id: "outmore-0604375214019", score: 9.0, award_label: "Bedst i test", best_for: "Alround squeeze-filter", editorial_note: "Katadyn BeFree er hurtig, let og nem at rengøre — det bedste alround-filter til de fleste ture.", pros: ["Meget hurtigt flow", "Let + kompakt", "Nem at back-flush"], cons: ["Membran tåler ikke frost", "Pose slides over tid"], specs: { type: "squeeze", fjerner: "bakterier+parasitter" } },
      { product_id: "outmore-7640144285234", score: 8.3, award_label: "Bedst til prisen", best_for: "Billig nødfilter", editorial_note: "LifeStraw Personal er den klassiske, billige livline — drik direkte fra kilden. Perfekt backup.", pros: ["Meget billig", "Enkel og robust", "God backup"], cons: ["Drik direkte (ingen opsamling)", "Langsommere"], specs: { type: "straw", fjerner: "bakterier+parasitter" } },
      { product_id: "outmore-7640144288129", score: 8.4, award_label: "Bedste letvægt", best_for: "Letvægt vandring", editorial_note: "LifeStraw Peak SOLO er lille og let — et fint kompakt filter til den vægtbevidste.", pros: ["Let + kompakt", "Fleksibel brug", "God kvalitet"], cons: ["Lille kapacitet", "Drik/squeeze"], specs: { type: "straw/squeeze" } },
      { product_id: "outmore-7640144287078", score: 8.5, award_label: "Bedste filter-flaske", best_for: "Filter i flasken", editorial_note: "LifeStraw Go 2.0 kombinerer flaske og filter — fyld op, drik rent. Praktisk til dagsture.", pros: ["Alt-i-en flaske", "Praktisk til dagsture", "Genopfyldelig"], cons: ["Tungere end bar filter", "Begrænset volumen"], specs: { type: "flaske+filter" } },
      { product_id: "outmore-7640144289119", score: 8.0, award_label: "Bedste til hverdag", best_for: "Hverdags-/dagstur", editorial_note: "LifeStraw SIP er en enkel filter-løsning til hverdag og kortere ture.", pros: ["Enkel", "Let", "God pris"], cons: ["Lille kapacitet", "Basal"], specs: { type: "straw" } },
      { product_id: "outmore-7612013136626", score: 8.2, award_label: "Bedste backup (kemisk)", best_for: "Backup / fylder intet", editorial_note: "Katadyn Micropur Forte renser kemisk — vejer og fylder intet, perfekt som backup når filteret svigter.", pros: ["Fylder/vejer intet", "Lang holdbarhed", "God backup"], cons: ["Tager tid", "Smag af klor"], specs: { type: "tabletter" } },
      { product_id: "outmore-7640144287849", score: 8.6, award_label: "Bedste til gruppen", best_for: "Gruppe / basecamp", editorial_note: "LifeStraw Peak Gravity hænger og filtrerer store mængder af sig selv — ideelt til grupper og basecamp.", pros: ["Stor kapacitet", "Hands-free (gravitation)", "Godt til flere"], cons: ["Fylder mere", "Langsommere opsætning"], specs: { type: "gravitation" } },
    ],
  },

  {
    slug: "haengekoje",
    title: "Bedste hængekøje 2026",
    category: "haengekoje",
    seo_title: "Bedste hængekøje 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste hængekøje til shelter og tur. Vi scorer favoritter — letvægt, dobbelt og budget, fra de bedste mærker.",
    intro: "En hængekøje er en let, hyggelig måde at sove ude på. Vi har scoret de bedste til shelter- og friluftsbrug — med fokus på vægt, komfort og værdi.",
    last_reviewed_at: TODAY,
    sources: [{ title: "Leave No Trace – ophæng uden at skade træer", url: "https://lnt.org/" }],
    faq: [
      { q: "Må man hænge hængekøje op i shelter-området?", a: "Ofte ja, men brug brede stropper (mindst 2-3 cm) der ikke skader barken, og følg lokale regler. På Naturstyrelsens pladser er ophæng i træer typisk tilladt med skånsomt udstyr — tjek skiltningen." },
      { q: "Hvad skal jeg ellers bruge end selve hængekøjen?", a: "Brede træstropper (suspension), et tarp mod regn, og — i myggesæsonen — et myggenet. Til kolde nætter skal du isolere undersiden med en underquilt eller et liggeunderlag, da en hængekøje køler nedefra." },
      { q: "Single eller double hængekøje?", a: "En double er bredere og mere komfortabel at ligge diagonalt i (også for én person), men vejer lidt mere. De fleste solo-brugere er glade for en double." },
      { q: "Er det varmt nok at sove i hængekøje?", a: "Du mister varme nedad, så uden isolering fryser du selv på milde nætter. Brug underquilt eller liggeunderlag under dig — så er hængekøje hyggeligt fra forår til efterår." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Hængekøje til tur — det vigtige\n\nGå efter **vægt, materiale og bredde**. En let ripstop-nylon-hængekøje pakker til en knytnæve og bærer nemt med. Bredere modeller (double) giver mere komfort, også for én person.\n\n## Husk isolering\n\nDu mister varme **nedad** i en hængekøje. Selv på milde nætter skal undersiden isoleres med en **underquilt** eller et **liggeunderlag** — ellers fryser du. Det er den vigtigste fejl nye hængekøje-sovere laver.\n\n## Tarp og myggenet\n\nEt **tarp** holder regnen ude; et **myggenet** er guld i sommermånederne. Mange køber hængekøje, stropper, tarp og net som et system.\n\n## Skån træerne\n\nBrug **brede stropper** (2-3 cm+) der ikke skærer i barken — det er både pænere og ofte et krav. Følg Leave No Trace.`,
    entries: [
      { product_id: "outmore-799696116378", score: 8.8, award_label: "Bedst i test", best_for: "Alround letvægt", editorial_note: "Cocoon Travel Hammock er let, stærk og behagelig til en fornuftig pris — vores alround-favorit til tur.", pros: ["God værdi", "Let + kompakt", "Behagelig"], cons: ["Stropper købes separat", "Single er smal for nogle"], specs: { type: "rejse/letvægt", personer: 1 } },
      { product_id: "outmore-5709388146779", score: 8.0, award_label: "Bedst til prisen", best_for: "Billigst", editorial_note: "Easy Camp Pine XL er den billige indgang — rummelig og fin til lejr og hygge.", pros: ["Meget billig", "Rummelig (XL)", "Nem"], cons: ["Tungere stof", "Basal kvalitet"], specs: { type: "lejr", personer: 1 } },
      { product_id: "outmore-0811201017359", score: 8.5, award_label: "Bedste letvægt", best_for: "Ultralet vandring", editorial_note: "Eno Sub6 er ekstremt let — til gram-tællere der vil bære mindst muligt.", pros: ["Ekstremt let", "Pakker til intet", "Stærkt mærke (Eno)"], cons: ["Tyndt stof", "Stropper separat"], specs: { type: "ultralet", personer: 1 } },
      { product_id: "outmore-0727670933642", score: 8.9, award_label: "Bedste premium", best_for: "Premium letvægt", editorial_note: "Ticket to the Moon Lightest forener lav vægt og høj kvalitet — premium uden at være tung.", pros: ["Let + holdbar", "Topkvalitet", "God forarbejdning"], cons: ["Højere pris", "Stropper separat"], specs: { type: "premium letvægt", personer: 1 } },
      { product_id: "outmore-799696116385", score: 8.4, award_label: "Bedste til to / komfort", best_for: "Ekstra plads / to personer", editorial_note: "Cocoon Travel Double er bred og behagelig — også dejlig for én der vil ligge diagonalt.", pros: ["Bred og komfortabel", "God til to", "Solid"], cons: ["Tungere", "Fylder mere"], specs: { type: "double", personer: 2 } },
      { product_id: "outmore-4025122942751", score: 8.0, award_label: "Bedste til lejr", best_for: "Afslapning i lejren", editorial_note: "Chillounge Green Bay er en behagelig spreader-bar-hængekøje til afslapning i lejren — mindre til vandring, mere til hygge.", pros: ["Meget behagelig", "Ligger fladt", "Lækkert stof"], cons: ["Tung + fylder", "Ikke til vandring"], specs: { type: "spreader-bar", personer: 1 } },
    ],
  },

  {
    slug: "kniv",
    title: "Bedste friluftskniv 2026",
    category: "kniv",
    seo_title: "Bedste friluftskniv 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste friluftskniv og foldekniv. Vi scorer favoritter — Morakniv, Opinel, Victorinox og Gerber, fra budget til bushcraft.",
    intro: "En god kniv er det mest brugte stykke grej på tur — til mad, snitning og småreparationer. Vi har scoret de bedste friluftsknive og foldeknive til pengene.",
    last_reviewed_at: TODAY,
    sources: [{ title: "Dansk knivlov – hvad må man bære?", url: "https://politi.dk/" }],
    faq: [
      { q: "Må man bære kniv i naturen i Danmark?", a: "Du må gerne medbringe og bruge en kniv til et anerkendelsesværdigt formål (madlavning, friluftsliv, fiskeri) på tur. Det er bæring uden grund på offentlige steder (byen, nattelivet) der er ulovligt. Transportér kniven forsvarligt pakket til og fra turen." },
      { q: "Fast eller foldekniv?", a: "En fastkniv (fixed blade) er stærkest og bedst til snitning og bushcraft. En foldekniv er mere kompakt og praktisk i lommen til mad og lette opgaver. Mange tager en let foldekniv til daglig og en fastkniv til længere ophold." },
      { q: "Hvad er en god billig friluftskniv?", a: "Morakniv Companion (omkring 130-150 kr) er legendarisk værdi — skarp, robust og alt de fleste behøver. Opinel No 8 er den klassiske billige foldekniv." },
      { q: "Rustfri eller kulstofstål?", a: "Rustfri er vedligeholdelsesfri og god til fugtigt klima. Kulstofstål er nemmere at slibe skarpt, men ruster hvis det ikke holdes tørt og olieret. Til dansk vejr er rustfri det nemmeste valg." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Fast eller foldekniv?\n\nEn **fastkniv** er stærkest — bedst til snitning, madlavning og bushcraft. En **foldekniv** er kompakt og praktisk i lommen. Til de fleste shelterture er en let foldekniv nok; tager du på længere ophold, er en fastkniv rar.\n\n## Stål\n\n**Rustfri** er vedligeholdelsesfri og god i fugtigt dansk klima. **Kulstofstål** bliver skarpere og er nemt at slibe, men skal holdes tørt og olieret.\n\n## Lovligt på tur\n\nDu må medbringe og bruge kniv til friluftsformål på tur — men ikke bære den uden grund i byen. Pak den forsvarligt under transport.\n\n## Typiske købsfejl\n\nAt købe en stor "survival"-kniv man aldrig bruger, og at glemme at vedligeholde kulstofstål.`,
    entries: [
      { product_id: "outmore-7391846014706", score: 9.2, award_label: "Bedst i test", best_for: "Alround friluftskniv", editorial_note: "Morakniv Companion er den legendariske svenske friluftskniv: knivskarp, robust og billig. Alt de fleste nogensinde får brug for.", pros: ["Fremragende værdi", "Knivskarp + robust", "Klassiker der bare virker"], cons: ["Fastkniv (skal i skede)", "Simpel finish"], specs: { type: "fastkniv", staal: "rustfri" } },
      { product_id: "backpackerlife-287981", score: 8.8, award_label: "Bedst til prisen", best_for: "Klassisk foldekniv", editorial_note: "Opinel No 8 er den ikoniske franske foldekniv — let, skarp og billig. Perfekt til mad og lette opgaver.", pros: ["Billig klassiker", "Let + lommevenlig", "Skarp"], cons: ["Træskaft tåler ikke langvarig fugt", "Simpel lås"], specs: { type: "foldekniv", staal: "rustfri/kulstof" } },
      { product_id: "outmore-7391846011583", score: 8.6, award_label: "Bedste til bushcraft", best_for: "Bushcraft / snitning", editorial_note: "Morakniv Companion FxF er bygget til hårdere brug og snitning — robust til bushcraft og bål.", pros: ["Robust til snitning", "Godt greb", "Skarp"], cons: ["Fastkniv", "Mere kniv end nogle behøver"], specs: { type: "fastkniv", staal: "rustfri" } },
      { product_id: "outmore-7611160009777", score: 8.2, award_label: "Bedste kompakt", best_for: "Kompakt med værktøj", editorial_note: "Victorinox Bantam er en slank Swiss Army-kniv med klinge + et par værktøjer — let og altid med i lommen.", pros: ["Slank + let", "Klinge + værktøj", "Schweizisk kvalitet"], cons: ["Kort klinge", "Ikke til hårdt arbejde"], specs: { type: "foldekniv/SAK", staal: "rustfri" } },
      { product_id: "outmore-013658170063", score: 8.0, award_label: "Bedste lette foldekniv", best_for: "Let EDC-foldekniv", editorial_note: "Gerber Mini Paraframe er en let, billig foldekniv med clip — fin til hverdag og tur.", pros: ["Let med clip", "Billig", "Enkel"], cons: ["Basal stål", "Simpel"], specs: { type: "foldekniv", staal: "rustfri" } },
      { product_id: "outmore-3123840010897", score: 8.5, award_label: "Bedste med skede", best_for: "Foldekniv m. skede", editorial_note: "Opinel No 8 i rustfri med skede er en pæn opgradering af klassikeren — klar til bæltet på tur.", pros: ["Rustfri (pasningsfri)", "Med skede", "Klassisk kvalitet"], cons: ["Stadig simpel lås", "Træskaft"], specs: { type: "foldekniv", staal: "rustfri" } },
    ],
  },

  {
    slug: "sovepose-til-vinter",
    title: "Bedste sovepose til vinter 2026",
    category: "sovepose",
    parent_slug: "sovepose",
    seo_title: "Bedste sovepose til vinter 2026 – test & guide | ShelterDK",
    seo_description: "Find den bedste vinter-sovepose til kulde og sne. Vi scorer 4-sæsons- og minusgrads-poser fra budget til premium dun.",
    intro: "Skal du sove ude i kulden, er en almindelig 3-sæsons pose ikke nok. Her er vores scorede favoritter blandt 4-sæsons- og minusgrads-soveposer — fra budget til premium dun.",
    last_reviewed_at: TODAY,
    sources: [{ title: "EN/ISO 23537 – temperatur-ratings", url: "https://en.wikipedia.org/wiki/EN_13537" }],
    faq: [
      { q: "Hvor kold en sovepose skal jeg bruge om vinteren i Danmark?", a: "Til dansk vinter (ofte -5 til -10 °C om natten) bør du have en pose med komforttemperatur omkring -10 °C, så du har margin på de koldeste nætter. Husk at sove med uld-undertøj og hue — det flytter komforten flere grader." },
      { q: "Dun eller syntetisk til vinter?", a: "Dun giver mest varme for vægten og pakker mindst — ideelt til vinter hvor poserne ellers bliver store. Men dun skal holdes helt tør (sværere om vinteren med kondens). Syntetisk er billigere og tilgivende ved fugt, men fylder og vejer mere." },
      { q: "Hvad betyder 4-sæsons?", a: "En 4-sæsons sovepose er bygget til også at klare vinter — mere isolering, ofte skraldekrave om halsen og lynlås-skørt der holder kuldebroer ude. Tjek altid komforttemperaturen, ikke kun '4-sæson'-mærket." },
      { q: "Hvordan undgår jeg at fryse i vinter-soveposen?", a: "Brug et liggeunderlag med høj R-værdi (mindst 4-5), sov med tørt undertøj og hue, spis noget inden du går i seng, og luft posen så fugt slipper ud. Et lagenpose-liner kan give et par ekstra grader." },
      { q: "Kan jeg bruge en vinterpose om sommeren?", a: "Det kan blive for varmt — en -10 °C-pose er ofte ubehagelig over ~10 °C medmindre den har en god lynlås du kan åbne. Til sommer er en lettere pose mere behagelig." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Vinter stiller andre krav\n\nOm vinteren er det isolering, der tæller. En **4-sæsons- eller minusgrads-pose** har mere fyld, ofte en **skraldekrave** om halsen og et **lynlås-skørt**, der holder kuldebroer ude. Sigt efter en komforttemperatur omkring **-10 °C** til dansk vinter, og husk at temperatur-tal er vejledende — påklædning og liggeunderlag flytter komforten markant.\n\n## Dun vs. syntetisk om vinteren\n\n**Dun** vinder på varme-til-vægt og pakmål — vigtigt når vinterposer ellers bliver store og tunge. Men dun skal holdes **tør**, og kondens er en reel udfordring om vinteren. **Syntetisk** er billigere og tilgiver fugt, men fylder mere. Til de fleste danske vinterture er en god syntetpose et trygt valg; vil du minimere vægt og pakmål, og kan du holde posen tør, belønner dun dig.\n\n## Liggeunderlaget er halvdelen af varmen\n\nDu kan ikke snyde fysikken: en vinterpose uden et godt liggeunderlag holder dig ikke varm. Kombinér altid med et underlag med **R-værdi 4-5+** (gerne et skumunderlag under et oppusteligt). Det er den hyppigste vinter-fejl.\n\n## Pas på kondens\n\nOm vinteren fryser fugt fra din krop i posens yderlag. Luft posen dagligt, undgå at trække hovedet helt ned i posen (ånd udenfor), og overvej en pose med fugttransporterende yderstof.\n\n## Vores anbefaling\n\nTil de fleste vinterture i Danmark: en 4-sæsons pose i -10 °C-klassen kombineret med et liggeunderlag med høj R-værdi. Skal du minimere vægt på længere ture, så gå efter en dunmodel — og hold den tør.`,
    entries: [
      { product_id: "backpackerlife-922605", score: 8.4, award_label: "Bedst i test", best_for: "Alround 4-sæson", editorial_note: "Treklife Peak 4S rammer balancen mellem varme og pris til vinterbrug — vores alround-vinterfavorit.", pros: ["God 4-sæsons varme", "Skarp pris", "Solid til dansk vinter"], cons: ["Syntetisk fylder", "Ikke ultralet"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-499684", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget 4-sæson", editorial_note: "Treklife Horizon 220 er billigste vej til en rigtig 4-sæsons pose — fin til den prisbevidste vintercamper.", pros: ["Lav pris", "4-sæson", "Rummelig"], cons: ["Tungere", "Stort pakmål"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-284284", score: 8.7, award_label: "Bedste premium", best_for: "Premium dun til kulde", editorial_note: "Treklife Down 900 er en kraftig dunpose der holder varmen langt ned — premium til seriøse vinterture, lav vægt for varmen.", pros: ["Meget varm (dun)", "Lav vægt + lille pakmål", "4-sæson"], cons: ["Høj pris", "Skal holdes tør"], specs: { fyld: "dun", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-99138", score: 8.5, award_label: "Bedste robuste", best_for: "Robust militær-kvalitet", editorial_note: "Snugpak Softie Elite 5 er bygget robust til hård brug og kulde — populær i militær- og bushcraft-kredse.", pros: ["Robust og varm", "Tåler hård brug", "God lynlås"], cons: ["Tungere", "Stort pakmål"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-60895", score: 8.3, award_label: "Bedste til hård brug", best_for: "Bivuak / hård brug", editorial_note: "Carinthia Defence 1 er en slidstærk pose til bivuak og barske forhold — kvalitet der holder.", pros: ["Meget slidstærk", "Varm", "Pålidelig"], cons: ["Tung", "Pris"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-922595", score: 8.0, award_label: "Bedste alternativ", best_for: "Solidt 4-sæson-alternativ", editorial_note: "Treklife Core 4S er et solidt, billigt alternativ hvis testvinderen er udsolgt.", pros: ["God værdi", "4-sæson", "Enkel"], cons: ["Syntetisk fylder", "Basal finish"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
    ],
  },

  {
    slug: "sovepose-til-boern",
    title: "Bedste sovepose til børn 2026",
    category: "sovepose",
    parent_slug: "sovepose",
    seo_title: "Bedste børnesovepose 2026 – test & guide | ShelterDK",
    seo_description: "Find den bedste sovepose til børn til shelter, telt og overnatning. Vi scorer trygge, varme og billige børnesoveposer.",
    intro: "Børn fryser hurtigere end voksne, så en god børnesovepose handler om varme, pasform og tryghed. Her er vores scorede favoritter til shelter, telt og overnatning hos kammerater.",
    last_reviewed_at: TODAY,
    sources: [{ title: "Råd om børn og kulde udendørs", url: "https://www.sundhed.dk/" }],
    faq: [
      { q: "Hvilken størrelse sovepose til mit barn?", a: "Vælg en pose der passer til barnets højde — for meget tomt rum gør posen kold, fordi barnet selv skal varme luften op. Mange børneposer kan justeres/forkortes, så de holder længere. Undgå at købe en voksenpose 'til at vokse i'." },
      { q: "Hvor varm skal en børnesovepose være?", a: "Børn fryser hurtigere end voksne, så vælg en pose med god margin — en komforttemperatur et par grader lavere end du ville vælge til dig selv. Et liggeunderlag under barnet er lige så vigtigt som posen." },
      { q: "Dun eller syntetisk til børn?", a: "Syntetisk er det praktiske valg til børn: billigere, tåler fugt og 'uheld', og kan vaskes nemt. Dun er sjældent pengene værd til børn, der hurtigt vokser ud af posen." },
      { q: "Hvordan sikrer jeg at mit barn ikke fryser?", a: "Læg et godt liggeunderlag under, lad barnet sove i tørt uld-undertøj og hue, og tjek at posen ikke er for stor. Et lille barn kan med fordel sove tæt på en voksen de første gange." },
      { q: "Fra hvilken alder kan børn sove i sovepose ude?", a: "Større børn (fra ca. 4-5 år) klarer fint en børnesovepose. Helt små bør sove tæt på en voksen og med ekstra opsyn — vurder altid vejret og barnets robusthed." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Det vigtigste til børn: pasform og varme\n\nBørn fryser hurtigere end voksne og har mindre krop til at varme posen op. Derfor er **pasform** afgørende: en pose der er for stor bliver kold, fordi barnet skal varme et stort tomt rum. Vælg efter barnets højde — eller en pose der kan **justeres/forkortes**, så den holder over flere år.\n\n## Syntetisk er det praktiske valg\n\nTil børn anbefaler vi næsten altid **syntetisk** fyld: det er billigere, tåler fugt og natuheld, og kan vaskes nemt. Dun er sjældent pengene værd, når børn hurtigt vokser ud af posen.\n\n## Glem ikke liggeunderlaget\n\nDet meste kulde kommer fra jorden — også for børn. Et godt liggeunderlag under barnet er lige så vigtigt som selve posen. Til kølige nætter: tjek at underlaget isolerer (R-værdi), ikke bare polstrer.\n\n## Tryghed på den første tur\n\nSkal barnet sove ude for første gang, så gør det hyggeligt: tørt undertøj og hue, en kendt bamse, og evt. at sove tæt på en voksen. En god første oplevelse er det, der skaber små friluftsmennesker.\n\n## Vores anbefaling\n\nEn justerbar syntetisk børnesovepose med god margin i varmen, kombineret med et ordentligt liggeunderlag, dækker langt de fleste familieture.`,
    entries: [
      { product_id: "backpackerlife-491580", score: 8.5, award_label: "Bedst i test", best_for: "Alround børnesovepose", editorial_note: "Snugpak Sleeper Kids forener varme, kvalitet og en fornuftig pris — vores alround-favorit til børn.", pros: ["God varme til børn", "Kvalitetsmærke", "Holdbar"], cons: ["Lidt dyrere end de billigste", "Begrænset levetid ifht. vækst"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-172792", score: 8.0, award_label: "Bedst til prisen", best_for: "Billig 4-sæson til børn", editorial_note: "Treklife Junior 4-sæson er billig og alsidig — fin til det meste af året.", pros: ["Meget billig", "4-sæson", "Justerbar"], cons: ["Basal kvalitet", "Fylder"], specs: { fyld: "syntetisk", form: "mumie", saeson: "4-sæsons" } },
      { product_id: "backpackerlife-527237", score: 8.2, award_label: "Bedste til hygge", best_for: "Sjov + varm", editorial_note: "Highlander Creature er en sjov og varm børnepose, der gør overnatningen til en oplevelse.", pros: ["Sjovt design", "Varm", "God pris"], cons: ["Mest til mindre børn", "Simpel lynlås"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-146993", score: 7.8, award_label: "Bedste til små", best_for: "Mindre børn", editorial_note: "Trespass Bunka er en kompakt, billig pose til de mindre børn.", pros: ["Billig", "Let", "Kompakt"], cons: ["Kun til mindre børn", "Mild-vejr"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "outmore-5709388159038", score: 8.1, award_label: "Bedste komfort", best_for: "Komfort / camping", editorial_note: "Outwell Contour Junior er behagelig og rummelig — god til campingpladsen.", pros: ["Behagelig", "God plads", "Kvalitet"], cons: ["Fylder", "Mest til camping"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-71376", score: 7.8, award_label: "Bedste enkle", best_for: "Enkel og billig", editorial_note: "Sleepline Junior er en enkel, billig løsning til den første tur.", pros: ["Lav pris", "Enkel", "Let"], cons: ["Basal", "Mild-vejr"], specs: { fyld: "syntetisk", form: "mumie" } },
    ],
  },

  {
    slug: "sommersovepose",
    title: "Bedste sommersovepose 2026",
    category: "sovepose",
    parent_slug: "sovepose",
    seo_title: "Bedste sommersovepose 2026 – let & billig | ShelterDK",
    seo_description: "Find den bedste sommersovepose til lune nætter. Vi scorer lette 2-sæsons-poser og lagenposer — billige og kompakte.",
    intro: "Om sommeren behøver du ikke en tung pose — bare noget let, der tager nattekulden. Her er vores scorede favoritter blandt lette 2-sæsons-soveposer og lagenposer.",
    last_reviewed_at: TODAY,
    sources: [{ title: "EN/ISO 23537 – temperatur-ratings", url: "https://en.wikipedia.org/wiki/EN_13537" }],
    faq: [
      { q: "Hvor varm skal en sommersovepose være?", a: "Til danske sommernætter rækker en pose med komforttemperatur omkring 8-12 °C. Bliver det rigtig varmt, vil du have en pose med god lynlås du kan åbne — eller bare en lagenpose." },
      { q: "Hvad er en lagenpose, og er det nok om sommeren?", a: "En lagenpose (liner) er en tynd pose i bomuld, silke eller kunstfiber. På varme nætter kan den være nok alene; ellers giver den et par ekstra grader i en almindelig pose og holder den ren." },
      { q: "Kan jeg klare mig med min vinterpose om sommeren?", a: "Det bliver ofte for varmt og klamt. En let sommerpose pakker desuden meget mindre og vejer næsten ingenting — rart på sommerture hvor pladsen i rygsækken tæller." },
      { q: "Dun eller syntetisk til sommer?", a: "Til sommer betyder isolering mindre, så syntetisk er det billige, praktiske valg. En let dun- eller kunstdunspose kan dog pakke imponerende småt, hvis vægt og pakmål er vigtigt." },
      { q: "Hvad med myg og varme i shelter om sommeren?", a: "En let pose + et myggenet (eller et shelter med net) gør sommernætterne behagelige. Vælg en pose du kan åbne helt op som et tæppe, hvis det bliver lummert." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sommer = let og luftig\n\nOm sommeren er målet ikke maksimal varme, men **lav vægt, lille pakmål og ventilation**. En pose med komforttemperatur omkring **8-12 °C** dækker de fleste danske sommernætter. Vælg gerne en model med en god lynlås, du kan åbne helt op som et tæppe, hvis det bliver lummert.\n\n## Lagenpose — det undervurderede sommer-trick\n\nEn **lagenpose** (liner) i bomuld eller silke kan på varme nætter være nok i sig selv. Den vejer næsten intet, holder din pose ren, og giver et par ekstra grader når den lægges i en almindelig pose. Et billigt, fleksibelt valg til sommeren.\n\n## Vægt og pakmål\n\nPå sommerture med let pakning tæller hver liter i rygsækken. En let sommerpose pakker til en brøkdel af en vinterpose — rart når du også skal have telt, mad og vand med.\n\n## Husk stadig underlaget\n\nSelv om sommeren mister du varme mod jorden. Et tyndt liggeunderlag er nok til milde nætter, men dropper du det helt, bliver selv en lun nat kold.\n\n## Vores anbefaling\n\nTil de fleste sommerture: en let 2-sæsons pose i 8-12 °C-klassen, evt. suppleret med en lagenpose til de varmeste nætter.`,
    entries: [
      { product_id: "backpackerlife-640487", score: 8.6, award_label: "Bedst i test", best_for: "Alround sommer", editorial_note: "Nordisk Bjarni +10 er en let, behagelig sommerpose fra et stærkt mærke — vores alround-sommerfavorit.", pros: ["Let og luftig", "Godt mærke (Nordisk)", "Behagelig pasform"], cons: ["Kun til milde nætter", "Mumie kan føles snæver"], specs: { komfort_temp: 10, fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-41543", score: 8.0, award_label: "Bedst til prisen", best_for: "Billig sommer", editorial_note: "Sleepline 250 er billigste vej til en fin 2-sæsons sommerpose.", pros: ["Meget billig", "Let", "Enkel"], cons: ["Basal", "Kun varmt vejr"], specs: { fyld: "syntetisk", form: "mumie", saeson: "2-sæsons" } },
      { product_id: "backpackerlife-62525", score: 8.3, award_label: "Bedste letvægt", best_for: "Let / rejse", editorial_note: "Snugpak Travelpak 2 er kompakt og let — ideel til rejse og let sommer-pakning.", pros: ["Meget kompakt", "Let", "God kvalitet"], cons: ["Snæver", "Kun sommer"], specs: { fyld: "syntetisk", form: "mumie" } },
      { product_id: "backpackerlife-212372", score: 8.4, award_label: "Bedste komfort", best_for: "Plads + komfort", editorial_note: "Nordisk Puk +10 Curve XL giver ekstra plads at vende sig i — behagelig til den der ikke kan lide stramme mumieposer.", pros: ["God plads (XL/curve)", "Behagelig", "Stærkt mærke"], cons: ["Fylder mere", "Kun mildt vejr"], specs: { komfort_temp: 10, fyld: "syntetisk", form: "curve" } },
      { product_id: "backpackerlife-171616", score: 7.9, award_label: "Bedste enkle", best_for: "Enkel 2-sæson", editorial_note: "Treklife Voyage er en enkel, billig 2-sæsons pose til sommer og det tidlige efterår.", pros: ["Lav pris", "Let", "2-sæson"], cons: ["Basal", "Begrænset varme"], specs: { fyld: "syntetisk", form: "mumie", saeson: "2-sæsons" } },
      { product_id: "outmore-5031863655309", score: 7.8, award_label: "Bedste lagenpose", best_for: "Lagenpose til varme nætter", editorial_note: "Lifeventure Cotton Liner er den lette lagenpose — nok alene på varme nætter, og et par ekstra grader resten af året.", pros: ["Næsten vægtløs", "Holder posen ren", "Fleksibel"], cons: ["Ikke en pose i sig selv (køligt)", "Lille varmebidrag"], specs: { type: "lagenpose" } },
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
  // Idempotent replace: fjern eksisterende entries så guiden afspejler præcis
  // den aktuelle selektion (ellers hober gamle v1-produkter sig op).
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
  console.log("\nFærdig (v2). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
