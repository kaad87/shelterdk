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
