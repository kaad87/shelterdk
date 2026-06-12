// Seed v3: 4 nye købsguider (vandrerygsæk, stormkøkken, campingstol, tarp).
// Samme idempotente mønster som seed_buying_guides.mjs (upsert på slug,
// entries erstattes pr. guide). Kør: node seed_buying_guides_v3.mjs
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
  // ───────────────────────── VANDRERYGSÆK ─────────────────────────
  {
    slug: "vandrerygsaek",
    title: "Bedste vandrerygsæk 2026",
    category: "rygsaek",
    seo_title: "Bedste vandrerygsæk 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste vandrerygsæk til shelterture og vandring. Vi scorer 7 favoritter fra dagstur til trekking — pasform, liter og bæresystem forklaret.",
    intro: "Vi har scoret de bedste vandrerygsække til shelterture og dansk vandring — fra lette dagstursrygsække til store trekking-sække, med fokus på bæresystem og værdi frem for ren litervolumen.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best backpacking packs", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-backpacking-backpacks" },
      { title: "Hærvejen – pakning og udstyr til vandring", url: "https://haervej.dk/" },
    ],
    faq: [
      { q: "Hvor mange liter rygsæk skal jeg bruge til en sheltertur?", a: "Til en enkelt overnatning i shelter rækker 30-45 liter til de fleste — sovepose, liggeunderlag, mad og skiftetøj kan være der, når grejet er moderne og kompakt. Til flerdagsture eller vinterture med mere og større grej er 50-65 liter mere realistisk. Køb ikke større end du behøver: en stor rygsæk bliver altid pakket fuld." },
      { q: "Hvad er vigtigst: liter eller bæresystem?", a: "Bæresystemet. En velindstillet rygsæk med god hoftebælte flytter 70-80 % af vægten fra skuldrene til hofterne — det mærkes langt mere end 5 liter fra eller til. Prøv pasformen med vægt i, og justér ryglængden hvis modellen tillader det." },
      { q: "Hvad koster en god vandrerygsæk?", a: "Gode dagstursrygsække (20-35 L) fås fra omkring 300-600 kr. En kvalitets-vandrerygsæk med rigtigt bæresystem til weekendture ligger typisk på 1.300-1.800 kr, og store trekking-sække fra anerkendte mærker koster 2.000-3.000 kr. Det er en investering der holder i mange år." },
      { q: "Skal kvinder vælge en dame-specifik rygsæk?", a: "Ofte ja, ved større rygsække: dame-modeller har kortere ryglængde, smallere skulderstropper og hoftebælte formet til en anden hofteform. Ved små dagsture (under ~30 L) betyder det mindre. Tatonka Yukon i dame-versionen i denne guide er et godt eksempel på en rigtig dame-trekkingsæk." },
      { q: "Hvordan pakker jeg rygsækken rigtigt?", a: "Tungt tæt på ryggen og midt i sækken (mad, vand), let i bunden (sovepose) og ofte brugte ting øverst eller i lommerne (regnjakke, snacks, kort). Brug kompressionsremmene, så lasten ikke slingrer — og hold den samlede vægt under ca. 20-25 % af din kropsvægt." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige vandrerygsæk\n\nTre ting afgør om en rygsæk bærer godt: **bæresystemet**, **størrelsen** og **pasformen**. Literantallet får al opmærksomheden, men det er hoftebæltet og rygpanelet, der afgør om du går glad i mål eller har ondt i skuldrene efter fem kilometer.\n\n## Hvor stor skal den være?\n\n- **20-35 liter:** Dagsture og lette sommerovernatninger i shelter, hvor grejet er kompakt\n- **35-50 liter:** Weekendture med sovepose, liggeunderlag og mad — den mest alsidige størrelse til danske shelterture\n- **50-70 liter:** Flerdagsture, vinterture og familieture hvor du bærer for flere\n\nEn tommelfingerregel: vælg den mindste størrelse, der kan rumme din **tungeste** typiske tur. En halvtom stor sæk bærer dårligere end en velpakket mindre.\n\n## Bæresystemet — det du faktisk betaler for\n\nPrisforskellen mellem en 400 kr- og en 1.700 kr-rygsæk ligger næsten udelukkende i bæresystemet: et stift rygpanel der overfører vægt til et polstret hoftebælte, justerbar ryglængde og ventilation mod ryggen. Med 10+ kg på ryggen er det forskellen mellem at mærke vægten i hofterne (fint) og i nakken (skidt).\n\nTjek ved køb: kan ryglængden justeres til din ryg? Sidder hoftebæltet på hoftekammen — ikke om maven? Kan du stramme load-lifter-remmene (de små remme over skuldrene), så sækken læner ind mod ryggen?\n\n## Detaljer der gør hverdagen lettere\n\nEn regnslag (inkluderet eller købt til), bundadgang til soveposen, sidelommer du kan nå med sækken på, og et separat låg-rum til småting. Til shelterbrug er bundadgangen undervurderet: soveposen ligger nederst, og du skal have den ud først når du ankommer.\n\n## Typiske købsfejl\n\nAt købe for stort \"for en sikkerheds skyld\"; at vælge efter looks i stedet for pasform; og at spare bæresystemet væk på en sæk, der skal bære 12 kg. Omvendt: til lette dagsture er en simpel, billig daypack helt fin — dér er det dyre bæresystem spildt.\n\n## Vores anbefaling\n\nTil de fleste shelter-vandrere: en 35-45 liters sæk med rigtigt hoftebælte i 1.300-1.800 kr-klassen — vores testvinder Gregory Paragon RC 40 er præcis dét. Skal du kun på dagstur, så spar pengene og tag en let daypack i stedet.`,
    entries: [
      { product_id: "backpackerlife-745928", score: 8.8, award_label: "Bedst i test", best_for: "Weekendture / alround", editorial_note: "Gregory Paragon RC 40 rammer den perfekte balance: førsteklasses bæresystem, 40 liter der dækker alt fra dagstur til weekend-sheltertur, og Gregorys legendariske pasform. Vores klare alround-vinder.", pros: ["Fremragende bæresystem", "Justerbar ryglængde", "Perfekt størrelse til shelterture"], cons: ["Mellemhøj pris", "Kun én farve"], specs: { personer: null, type: "vandrerygsæk 40 L" } },
      { product_id: "backpackerlife-3576", score: 7.9, award_label: "Bedst til prisen", best_for: "Budget / første rygsæk", editorial_note: "Trek-rygsækken på 33 liter er den billige vej i gang: nok plads til en let sommerovernatning og fin til dagsture — uden det avancerede bæresystem, men også uden den store regning.", pros: ["Meget lav pris", "God størrelse til begyndere", "Let"], cons: ["Basalt bæresystem", "Ikke til tung last"], specs: { type: "rygsæk 33 L" } },
      { product_id: "outmore-7045952820859", score: 8.6, award_label: "Bedste kvalitet/holdbarhed", best_for: "Mange års brug", editorial_note: "Lundhags Fulu Core 35 er bygget i svensk kvalitetstradition: enkel, ekstremt holdbar og med en ærlig, justerbar pasform. Køb én gang, brug den i ti år.", pros: ["Meget holdbar konstruktion", "Skandinavisk kvalitetsmærke", "Vejrbestandig"], cons: ["Få lommer/features", "Pris over middel"], specs: { type: "vandrerygsæk 35 L" } },
      { product_id: "outmore-4013236383577", score: 8.4, award_label: "Bedste allrounder 45 L", best_for: "Weekend + flerdagsture", editorial_note: "Tatonka Akela 45 giver trekking-features — justerbart V2-bæresystem, bundadgang og regnslag — i en størrelse der stadig er håndterbar. Stærkt valg hvis turene nogle gange bliver længere.", pros: ["Justerbart bæresystem", "Bundadgang + regnslag", "God plads uden at blive kæmpe"], cons: ["Tungere egenvægt", "Lidt teknisk udseende"], specs: { type: "vandrerygsæk 45 L" } },
      { product_id: "backpackerlife-930417", score: 8.2, award_label: "Bedste komfort-letvægt", best_for: "Lette weekendture", editorial_note: "Jack Wolfskin Echotrek Shape 30 er en moderne, velventileret sæk med justerbar S-L-ryglængde — behagelig på kroppen og stor nok til den lette sheltertur.", pros: ["God rygventilation", "Justerbar ryglængde", "Behagelig pasform"], cons: ["30 L kræver kompakt grej", "Mellemhøj pris"], specs: { type: "vandrerygsæk 30 L" } },
      { product_id: "backpackerlife-622542", score: 8.5, award_label: "Bedste dame-trekkingsæk", best_for: "Kvinder / lange ture", editorial_note: "Tatonka Yukon 60+10 i dame-versionen er en rigtig trekkingsæk formet til kvinder: kortere ryg, formet hoftebælte og plads til alt — til Hærvejen, Camino eller vinter-shelterturen med fuldt grej.", pros: ["Ægte dame-pasform", "Stor kapacitet (60+10 L)", "Robust kvalitet"], cons: ["Høj pris", "Overkill til korte ture"], specs: { type: "trekkingrygsæk 60+10 L (dame)" } },
      { product_id: "outmore-9327868155743", score: 8.0, award_label: "Bedste packable", best_for: "Dagsture fra basecamp", editorial_note: "Sea to Summit Ultra-Sil pakker ned til håndfladestørrelse og vejer næsten intet — den perfekte ekstra-rygsæk til dagsture fra shelteret, når den store sæk bliver i lejren.", pros: ["Vejer ~30 gram", "Pakker mikroskopisk", "Overraskende holdbar silnylon"], cons: ["Ingen polstring/bæresystem", "Kun til let last"], specs: { type: "packable daypack 20 L" } },
    ],
  },

  // ───────────────────────── STORMKØKKEN ─────────────────────────
  {
    slug: "stormkoekken",
    title: "Bedste stormkøkken 2026",
    category: "stormkoekken",
    seo_title: "Bedste stormkøkken 2026 – Trangia, gas eller Jetboil? | ShelterDK",
    seo_description: "Find det bedste stormkøkken til shelter og friluftsliv. Vi scorer 8 favoritter — Trangia-sæt, gasbrændere og Jetboil — fra 149 til 1.232 kr.",
    intro: "Vi har scoret de bedste stormkøkkener og brændere til shelterture — fra det klassiske Trangia-sæt der aldrig svigter, til gasbrændere og Jetboil til dig der vil have kaffen hurtigt.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Trangia – officiel guide til stormkøkkenets dele", url: "https://trangia.se/en/" },
      { title: "OutdoorGearLab – best camping stoves", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-backpacking-stove" },
    ],
    faq: [
      { q: "Sprit eller gas til stormkøkken?", a: "Sprit (Trangia-klassikeren) er driftssikker i al slags vejr, brændstoffet fås overalt, og der er intet der kan gå i stykker — men det er langsommere. Gas koger næsten dobbelt så hurtigt og kan reguleres præcist, men dåserne mister tryk i kulde. Til afslappede shelterture vinder sprit på charme og robusthed; til hurtig morgenkaffe vinder gas." },
      { q: "Hvilken Trangia-størrelse skal jeg vælge?", a: "Trangia 27 er til 1-2 personer og fylder mindst — det rigtige valg til soloture og par. Trangia 25 er til 3-4 personer med større gryder og pande — vælg den til familien eller gruppen. UL-versionerne (ultralight aluminium) er prisstærke; nonstick og hårdanodiseret koster mere men er nemmere at gøre rent." },
      { q: "Må man bruge stormkøkken ved shelters?", a: "Ja, som udgangspunkt — et stormkøkken er ikke åben ild på samme måde som bål, og under bålforbud er det ofte (men ikke altid!) stadig tilladt. Tjek altid de lokale regler og pladsens skiltning, og brug det på et brandsikkert underlag i god afstand fra shelterets træværk." },
      { q: "Hvor hurtigt koger vand på de forskellige systemer?", a: "En liter vand tager cirka: Jetboil 3-4 minutter (bygget til præcis dét), gasbrænder 4-6 minutter, Trangia med spritbrænder 8-12 minutter afhængigt af vejr og vandtemperatur. Til frysetørret mad og kaffe er Jetboil suveræn; til rigtig madlavning er Trangias gryder og pande bedre." },
      { q: "Hvad koster et godt stormkøkken?", a: "Et komplet budget-sæt med spritbrænder fås fra ca. 250 kr, det klassiske Trangia 27-sæt fra ca. 600 kr, og Trangia 25 til familien 700-800 kr. En kvalitets-gasbrænder alene koster 150-630 kr, og et Jetboil-system ca. 1.200 kr. Spritbrænder-sættene har stort set ingen driftsomkostninger." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige stormkøkken\n\nValget står reelt mellem tre systemer: **Trangia-sættet** (spritbrænder + vindskærm + gryder i ét), **gasbrænderen** (let, hurtig, skruer direkte på en gasdåse) og **all-in-one-systemer som Jetboil** (integreret kop og brænder, bygget til at koge vand lynhurtigt). De kan alle lave mad — men de er gode til hver sit.\n\n## Trangia: klassikeren der aldrig svigter\n\nDer er en grund til at Trangia har set ens ud i 70 år: systemet virker. Vindskærmen ER grydestativet, spritbrænderen har ingen bevægelige dele, og alt pakker sammen inde i gryderne. I blæst — hvor billige gasbrændere kæmper — arbejder Trangiaen bare videre. Ulempen er tempoet: 8-12 minutter for en liter kogende vand kræver tålmodighed.\n\nStørrelserne: **27-serien** (1-2 personer) og **25-serien** (3-4 personer). Tallene bagefter (27-1, 27-3, 25-5…) beskriver gryde-konfigurationen: -1 er ren aluminium, -3 har nonstick-pande, og HA-versionerne er hårdanodiserede (mest holdbare). UL-aluminium er det prisstærke valg for de fleste.\n\n## Gas: hurtig og regulérbar\n\nEn gasbrænder koger vandet på under det halve af spritbrænderens tid og kan justeres fra simreblus til fuld styrke. Skru den på en standard-gasdåse, og du er i gang på 10 sekunder. Svaghederne: dåserne mister tryk i kulde (under ~5 °C mærkes det), du skal selv medbringe gryde og vindskærm, og en væltet gryde på en smal brænder er en klassiker. Trangias gas-konverterede sæt (25-1 UL Gas i denne guide) giver det bedste fra begge verdener — Trangia-stabilitet med gas-tempo.\n\n## Jetboil: kaffen på 3 minutter\n\nJetboil-systemet er bygget til én ting: koge vand hurtigere end alt andet. Integreret varmeveksler, kop og brænder i ét — perfekt til frysetørret mad, kaffe og solo-vandreren der tæller gram og minutter. Til rigtig madlavning (pande, simreretter) er det ikke sagen.\n\n## Typiske købsfejl\n\nAt købe en stor familie-Trangia til soloture (27-serien rækker); at glemme vindskærmen til en løs gasbrænder (halvdelen af varmen blæser væk); og at stå med en kold gasdåse i november og undre sig over det svage blus.\n\n## Vores anbefaling\n\nTil de fleste shelterfolk: **Trangia 27-3 UL** — komplet, driftssikkert og kompakt til 1-2 personer. Familien tager **25-3 UL**, den utålmodige tager **Jetboil Flash**, og er budgettet stramt, kommer du rigtig langt med det navnløse 2-personers sæt til 249 kr.`,
    entries: [
      { product_id: "backpackerlife-100157", score: 8.8, award_label: "Bedst i test", best_for: "Solo / par — klassikeren", editorial_note: "Trangia 27-3 UL er stormkøkkenet alle andre måles mod: komplet system med vindskærm, gryder og nonstick-pande der pakker i ét, og en spritbrænder der virker i al slags vejr. Køb det én gang, brug det i årtier.", pros: ["Komplet system i ét", "Virker i blæst og regn", "Nonstick-pande inkluderet"], cons: ["Langsommere end gas", "Sprit skal købes separat"], specs: { personer: "1-2", type: "spritbrænder-sæt" } },
      { product_id: "backpackerlife-46308", score: 7.9, award_label: "Bedst til prisen", best_for: "Budget / første sæt", editorial_note: "Det navnløse 2-personers sæt med spritbrænder koster en kvart Trangia og virker efter samme princip — den billigste komplette vej til varm mad i shelteret.", pros: ["Meget lav pris", "Komplet med spritbrænder", "Fin til begyndere"], cons: ["Tyndere materiale end Trangia", "Mindre forfinet vindskærm"], specs: { personer: "2", type: "spritbrænder-sæt" } },
      { product_id: "backpackerlife-100112", score: 8.6, award_label: "Bedste til familien", best_for: "3-4 personer", editorial_note: "Trangia 25-3 UL er storebroren med større gryder og nonstick-pande — nok kapacitet til familiens aftensmad uden at opgive Trangia-systemets pålidelighed.", pros: ["Plads til 3-4 personers mad", "Samme driftssikre system", "Nonstick gør rengøring nem"], cons: ["Fylder og vejer mere", "Overkill til solo"], specs: { personer: "3-4", type: "spritbrænder-sæt" } },
      { product_id: "backpackerlife-381748", score: 8.3, award_label: "Bedste ultralet", best_for: "Solo letvægt", editorial_note: "Trangia Micro er minimalisme: spritbrænder, minimal vindskærm og en lille gryde til solo-vandreren der tæller gram men vil have Trangia-pålidelighed.", pros: ["Meget let og kompakt", "Ægte Trangia-kvalitet", "Billig"], cons: ["Kun til solo", "Lille gryde"], specs: { personer: "1", type: "ultralet spritsæt" } },
      { product_id: "outmore-850019774672", score: 8.5, award_label: "Hurtigst i test", best_for: "Kaffe + frysetørret mad", editorial_note: "Jetboil Flash koger en liter vand på 3-4 minutter — uovertruffent til morgenkaffen og frysetørrede måltider. Systemtænkning hele vejen: kop, brænder og varmeveksler i ét.", pros: ["Koger lynhurtigt", "Alt-i-ét system", "Brændstoføkonomisk"], cons: ["Dyr", "Ikke til rigtig madlavning"], specs: { personer: "1-2", type: "gas-kogesystem" } },
      { product_id: "outmore-7330033000054", score: 8.4, award_label: "Bedste gasbrænder", best_for: "Letvægt + tempo", editorial_note: "Primus Micron III Piezo er en kompakt kvalitetsgasbrænder med piezo-tænding — skru den på dåsen, klik, og du har fuldt blus på sekunder. Husk selv gryde og vindskærm.", pros: ["Meget let og kompakt", "Piezo-tænding", "Præcis flammeregulering"], cons: ["Gryde/vindskærm købes separat", "Gas svækkes i kulde"], specs: { personer: "1-2", type: "gasbrænder" } },
      { product_id: "backpackerlife-154929", score: 8.2, award_label: "Bedste hybrid", best_for: "Trangia-stabilitet + gas-tempo", editorial_note: "Trangia 25-1 UL med gasbrænder er hybridvalget: Trangia-systemets vindskærm og gryder, men med gasblussets hastighed og regulering. Til familien der laver rigtig mad — hurtigt.", pros: ["Gas-tempo i Trangia-system", "Stabil og vindsikker", "God til større portioner"], cons: ["Højeste pris blandt Trangia-sættene", "Gasdåser i kulde"], specs: { personer: "3-4", type: "gas-stormkøkken" } },
      { product_id: "backpackerlife-516071", score: 7.7, award_label: "Bedste backup", best_for: "Backup / minimalbudget", editorial_note: "Piezo-gasbrænderen til 199 kr er den lille, billige løsning der bor permanent i sidelommen — som backup eller til den helt lette kaffetur.", pros: ["Billig", "Piezo-tænding", "Fylder ingenting"], cons: ["Smal gryde-støtte", "Ingen vindskærm"], specs: { personer: "1", type: "gasbrænder" } },
    ],
  },

  // ───────────────────────── CAMPINGSTOL ─────────────────────────
  {
    slug: "campingstol",
    title: "Bedste campingstol 2026",
    category: "campingstol",
    seo_title: "Bedste campingstol 2026 – test og købsguide | ShelterDK",
    seo_description: "Find den bedste campingstol til shelter, camping og bålhygge. Vi scorer 7 favoritter — fra letvægts-trekkingstole til polstrede komfortstole.",
    intro: "Vi har scoret de bedste campingstole til shelterture, festival og bålhygge — fra ultralette trekkingstole der kan bæres med, til polstrede komfortstole til basecampen.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best camping chairs", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-camping-chair" },
    ],
    faq: [
      { q: "Hvad er forskellen på en campingstol og en trekkingstol?", a: "Den klassiske campingstol (foldestol med armlæn) er billig, stabil og behagelig, men vejer 2-4 kg og fylder som en lille paraply-pose — fin når bilen holder tæt på. Trekkingstole som Sea to Summit Air Chair vejer under 1 kg og pakker ned i rygsækken, men koster mere. Vælg efter hvor langt du selv skal bære den." },
      { q: "Hvor meget må en campingstol veje, hvis den skal med i rygsækken?", a: "Skal stolen bæres mere end et par hundrede meter, så hold den under ca. 1 kg — det udelukker de klassiske foldestole. Mellem bil og shelter på under 5 minutters gang er 2-4 kg fint." },
      { q: "Hvor meget vægt kan en campingstol holde til?", a: "De fleste kvalitetsstole er testet til 100-120 kg, og XL-modeller (som Outwell Catamarca XL i guiden) til 150 kg. Tjek altid maksvægten — især ved de helt billige stole, hvor underdimensionerede led er det typiske svigtpunkt." },
      { q: "Kan campingstole stå i et shelter natten over?", a: "Ja, men tag dem ind under taget eller pak dem sammen — morgendug gør stofstole våde, og fugtigt stof i kulde er en kold start på dagen. Polstrede stole tager længst tid om at tørre." },
      { q: "Hvad koster en god campingstol?", a: "Fornuftige foldestole med armlæn starter ved ca. 200 kr, gode mellemklassestole ligger på 270-400 kr, letvægts-trekkingstole på 450-700 kr, og polstrede premium-stole som Outwell Tidal omkring 700 kr. Under 150 kr får du sjældent noget, der holder mere end én sæson." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige campingstol\n\nDet vigtigste spørgsmål er ikke komfort — det er **hvor langt du skal bære den**. Holder bilen ved siden af shelteret, kan du tage den store polstrede stol med armlæn. Skal stolen 2 km ind ad en skovsti, er vægt og pakmål pludselig alt.\n\n## De tre typer\n\n**Den klassiske foldestol** (Outwell Catamarca, Easy Camp Spruce) er festival- og campingpladsens arbejdshest: armlæn, kopholder, sætter sig op på ét sekund. Vejer 2-4 kg.\n\n**Trekkingstolen** (Sea to Summit Air Chair) består af stænger og et stofsæde, der samles på et minut og pakker ned på størrelse med en lille sovepose. Under 1 kg — den eneste type, der reelt kan komme med i rygsækken.\n\n**Komfortstolen** (Outwell Tidal) er polstret og høj i ryggen — basecamp-luksus til den lange aften ved bålet, men tungest af alle.\n\n## Det skal du kigge efter\n\n- **Maksvægt:** 100-120 kg er standard; tjek den, og gå efter XL-modeller hvis du er høj eller tung\n- **Sædehøjde:** Lave stole (under 30 cm) er gode ved bålet men svære at rejse sig fra; klassisk højde er 40-45 cm\n- **Ben-design:** Brede fødder eller tværgående meder synker ikke i blød skovbund — tynde, spidse ben gør\n- **Stof:** Polyester med god UV-bestandighed; mesh-partier er kølige om sommeren men kolde i oktober\n\n## Typiske købsfejl\n\nAt købe den billigste stol på tilbud (leddene knækker, og så står du med ingenting); at tage en 3 kg-stol med på vandretur fordi \"den er jo ikke så tung\" (det er den efter 2 km); og at glemme at lave stole + blød jord = våd bagdel når benene synker i.\n\n## Vores anbefaling\n\nTil bilcamping og shelterpladser tæt på P-pladsen: **Outwell Catamarca** — klassikeren der bare er god og billig. Skal stolen bæres, er **Sea to Summit Air Chair** pengene værd. Og til den faste plads ved bålet derhjemme eller i basecampen: **Outwell Tidal**.`,
    entries: [
      { product_id: "outmore-5709388146854", score: 8.6, award_label: "Bedst i test", best_for: "Alround camping/shelter", editorial_note: "Outwell Catamarca er den klassiske campingstol når den er bedst: stabil, behagelig, med armlæn og kopholder — til en pris hvor man næsten ikke kan gå galt. Vores klare alround-anbefaling.", pros: ["Stærk pris/kvalitet", "Armlæn + kopholder", "Stabil konstruktion"], cons: ["Vejer ~3 kg", "Fylder i bagagerummet"], specs: { type: "foldestol" } },
      { product_id: "outmore-5709388146700", score: 8.1, award_label: "Bedst til prisen", best_for: "Budget / festival", editorial_note: "Easy Camp Spruce er den billige foldestol der faktisk holder — med armlæn og fin komfort til shelterturen, festivalen og haven.", pros: ["Lav pris", "Armlæn", "Let at klappe op/sammen"], cons: ["Enklere stof", "Lavere maksvægt end premium"], specs: { type: "foldestol" } },
      { product_id: "outmore-9327868102044", score: 8.7, award_label: "Bedste letvægt", best_for: "Vandreture / rygsæk", editorial_note: "Sea to Summit Air Chair vejer under et kilo og pakker ned i rygsækken — den eneste stol i testen, du reelt kan tage med på vandretur. Samles på et minut og bærer overraskende godt.", pros: ["Under 1 kg", "Pakker mikroskopisk", "God siddekomfort for vægten"], cons: ["Højere pris", "Lav siddehøjde"], specs: { type: "trekkingstol" } },
      { product_id: "outmore-5709388120663", score: 8.2, award_label: "Bedste mellemklasse", best_for: "Hyppig brug", editorial_note: "Outwell Cardiel er skridtet op fra budgetstolene: bedre stof, solidere stel og en behageligere siddestilling — til dig der bruger stolen hver weekend.", pros: ["God komfort", "Solidt stel", "Pæn (Forest Green)"], cons: ["Stadig ~3 kg", "Få ekstra features"], specs: { type: "foldestol" } },
      { product_id: "outmore-5709388157041", score: 8.3, award_label: "Bedste komfort u. polstring", best_for: "Lange aftener", editorial_note: "Easy Camp Oak har høj ryg og god ergonomi — den man bliver siddende i ved bålet, uden at gå op i polstret premium-pris.", pros: ["Høj ryg", "God ergonomi", "Fornuftig pris"], cons: ["Større pakmål", "Tungere"], specs: { type: "foldestol høj ryg" } },
      { product_id: "outmore-5709388146915", score: 8.4, award_label: "Bedste XL", best_for: "Høje / op til 150 kg", editorial_note: "Catamarca XL er den velkendte klassiker i stor: højere ryg, bredere sæde og 150 kg maksvægt — campingstolen til store folk, der er trætte af for små stole.", pros: ["150 kg maksvægt", "Bredt, højt sæde", "Samme gode pris-DNA"], cons: ["Stor og tung", "Overkill til små personer"], specs: { type: "foldestol XL" } },
      { product_id: "outmore-5709388160584", score: 8.5, award_label: "Bedste premium", best_for: "Basecamp-luksus", editorial_note: "Outwell Tidal er polstret hele vejen og føles mere som en lænestol end en campingstol — til basecampen, sommerhuset og den lange bålaften hvor komfort vinder over vægt.", pros: ["Polstret ægte komfort", "Høj ryg", "Holdbar kvalitet"], cons: ["Tung og stor pakket", "Skal holdes tør"], specs: { type: "polstret komfortstol" } },
    ],
  },

  // ───────────────────────── TARP ─────────────────────────
  {
    slug: "tarp",
    title: "Bedste tarp 2026",
    category: "tarp",
    seo_title: "Bedste tarp 2026 – test og købsguide til shelter og bivuak | ShelterDK",
    seo_description: "Find den bedste tarp til shelterture, hængekøje og bivuak. Vi scorer 7 favoritter fra 425 til 1.600 kr — størrelse, vægt og opsætning forklaret.",
    intro: "Vi har scoret de bedste tarps til shelterture og bivuak i Danmark — den enkleste forsikring mod regn over bålpladsen, hængekøjen eller det åbne shelter.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "DD Hammocks – tarp setups guide", url: "https://www.ddhammocks.com/" },
      { title: "OutdoorGearLab – best camping tarps", url: "https://www.outdoorgearlab.com/" },
    ],
    faq: [
      { q: "Hvilken størrelse tarp skal jeg vælge?", a: "3x3 meter er den alsidige standard: stor nok til 2-3 personer, en hængekøje eller en overdækket bålplads-zone, og stadig håndterbar i vind. 2,5x2,5 m er nok til solo og letvægt, mens 4x4 m dækker familien eller en hel gruppes spiseområde — men kræver mere af både ophæng og opsætter." },
      { q: "Hvad bruger man en tarp til ved et shelter?", a: "Tre klassikere: som ekstra tag foran shelterets åbning når regnen står ind; over bålpladsen/spiseområdet så gruppen kan sidde tørt; og som selvstændigt ly (bivuak) på pladser uden ledigt shelter. Den vejer få hundrede gram og redder turen den dag vejrudsigten tog fejl." },
      { q: "Hvor mange barduner og pløkker skal jeg bruge?", a: "Minimum 6-8 punkter til en stabil opsætning: fire hjørner plus midterpunkter på siderne. De fleste tarps i guiden leveres med barduner og pløkker, men et par ekstra meter paracord og 4 ekstra pløkker i sidelommen gør dig langt mere fleksibel — især mellem træer." },
      { q: "Hvad betyder vandsøjle på en tarp?", a: "Vandsøjlen angiver hvor meget vandtryk stoffet tåler før det trænger igennem — 2.000 mm holder almindelig dansk regn ude, 3.000+ mm klarer også slagregn. Sømmene er det svage punkt: tjek at de er tapede, og efterimprægnér efter nogle sæsoner." },
      { q: "Tarp eller telt?", a: "En tarp er lettere, billigere og hurtigere at sætte op — og du sover 'ude' med udsigt og luft. Teltet vinder på myg, blæst fra skiftende retninger og privatliv. Mange shelterfolk ender med begge: tarpen som standard, teltet til de udsatte ture. Se også vores guide til de bedste telte." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige tarp\n\nEn tarp er det mest undervurderede stykke greh i shelter-Danmark: 300-700 gram stof der forvandler en våd aften til en tør en. Valget handler om **størrelse**, **vægt** og **ophængspunkter** — og om du primært skal dække en bålplads, en hængekøje eller dig selv.\n\n## Størrelsen — tarpens vigtigste valg\n\n- **2,5x2,5 m:** Solo-ly og letvægt; nok til én person + grej i bivuak\n- **3x3 m:** Standarden. Dækker 2-3 personer, en hængekøje med god margin eller en lille bålplads-zone. Kvadratisk = flest opsætningsmuligheder\n- **4x4 m og op:** Gruppe- og familieformat til spiseområdet — kræver solide ophæng og mere erfaring i vind\n- **Hexagonal** (Trekmates Hexagon): færre flagrende hjørner i blæst og pænt stramt look, men lidt mindre fleksibel end kvadratisk\n\n## Stof og vægt\n\nStandard-tarps i polyester med PU-belægning (Robens, Easy Camp, Tatonka) vejer 700-1.200 gram og tåler års brug. Ultralette sil-nylon-tarps som Sea to Summit Escapist kommer under 500 gram — mærkbart i rygsækken, men prisen er 2-3 gange højere og stoffet kræver lidt mere omtanke.\n\n## Ophængspunkter og opsætning\n\nFlere forstærkede ophængspunkter = flere måder at spænde den op på: klassisk A-frame mellem to træer, lean-to mod vinden ved shelterets åbning, eller flad 'tagkonstruktion' over spisepladsen med vandafløb i ét hjørne. Tommelfingerregel: 30-45 graders hældning, stram dug (en slap tarp samler vand og larmer i vind), og altid ét lavt punkt hvor regnen kan løbe af.\n\n## Typiske købsfejl\n\nAt købe for lille (en 3x3 vejer kun marginalt mere end en 2,5x2,5 men dækker 40 % mere); at glemme stænger på pladser uden gode træer (teleskopstænger fås fra ca. 300 kr); og at spare bardunerne væk — det er dem, der holder tarpen oppe når det blæser op kl. 03.\n\n## Vores anbefaling\n\nTil de fleste: **Robens Tarp 3x3 Exp** — kvadratisk standardstørrelse, solid kvalitet og fornuftig pris. På budget er **Easy Camp Norddal** fuldt brugbar, og vil du have det letteste på markedet, er **Sea to Summit Escapist** kongen — til en pris.`,
    entries: [
      { product_id: "outmore-5709388144959", score: 8.7, award_label: "Bedst i test", best_for: "Alround 3x3 standard", editorial_note: "Robens Tarp 3x3 Exp er den rigtige størrelse, det rigtige stof og den rigtige pris: kvadratiske 9 m² med solide ophængspunkter, der dækker alt fra hængekøje til bålplads. Tarpen til de fleste.", pros: ["Alsidig 3x3-størrelse", "Solide ophængspunkter", "God pris for kvaliteten"], cons: ["Ikke den letteste", "Kun én farve"], specs: { type: "tarp 3x3 m" } },
      { product_id: "outmore-5709388144652", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget / første tarp", editorial_note: "Easy Camp Norddal giver 3x3 meter regnly til den laveste pris i testen — stoffet er enklere, men den holder dig tør, og det er hele pointen.", pros: ["Billigste 3x3 i testen", "Komplet med barduner", "Let at sætte op"], cons: ["Enklere stof og søm", "Færre ophængspunkter"], specs: { type: "tarp 3x3 m" } },
      { product_id: "outmore-5709388145161", score: 8.2, award_label: "Bedste letvægt-kompakt", best_for: "Solo / bivuak", editorial_note: "Robens Pro i 2,5x2,5 m er solo-formatet: mindre, lettere og hurtigere at spænde op — perfekt over bivuakken eller som shelter-fortelt for én.", pros: ["Let og kompakt", "Pro-stof med god vandsøjle", "Hurtig opsætning"], cons: ["For lille til grupper", "Mindre fleksibel end 3x3"], specs: { type: "tarp 2,5x2,5 m" } },
      { product_id: "outmore-5056369300614", score: 8.3, award_label: "Bedste i blæst", best_for: "Kystpladser / vind", editorial_note: "Trekmates Hexagon-form spænder stramt op med færre flagrende hjørner — vores valg til kystshelters og åbne pladser, hvor vinden altid finder den løse flig.", pros: ["Hexform står stramt i vind", "Gennemtænkte ophæng", "Pæn og kompakt opsat"], cons: ["Mindre fleksibel form", "Dækker lidt mindre end 3x3"], specs: { type: "hexagonal tarp" } },
      { product_id: "outmore-5709388144584", score: 8.4, award_label: "Bedste til grupper", best_for: "Familie / fællesareal", editorial_note: "Easy Camp Totak på 4x4 meter overdækker hele gruppens spiseområde — 16 m² tørt fællesrum til familieture og spejdergrupper.", pros: ["16 m² dækning", "God pris pr. m²", "Fællesareal-format"], cons: ["Kræver gode ophæng/stænger", "Tung og stor pakket"], specs: { type: "tarp 4x4 m" } },
      { product_id: "outmore-4013236335781", score: 8.5, award_label: "Bedste kvalitet", best_for: "Mange års hård brug", editorial_note: "Tatonka Tarp 4 er bygget som resten af Tatonkas grej: overdimensionerede søm, kraftigt stof og ophængspunkter der tåler at blive misbrugt. Køb-én-gang-valget.", pros: ["Meget holdbar", "Kraftige ophængspunkter", "Gennemprøvet kvalitet"], cons: ["Tungere", "Pris over middel"], specs: { type: "tarp 285x400 cm" } },
      { product_id: "outmore-9327868042050", score: 8.6, award_label: "Bedste ultralet", best_for: "Vandreture / gram-jægere", editorial_note: "Sea to Summit Escapist 15D vejer en brøkdel af de andre — sil-nylon i ekspeditionskvalitet til vandreren, hvor hvert gram tæller. Dyrest i testen, lettest i rygsækken.", pros: ["Ekstremt lav vægt", "Pakker mikroskopisk", "15D sil-nylon kvalitet"], cons: ["Høj pris", "Tyndt stof kræver omtanke"], specs: { type: "ultralet tarp 2x2,6 m" } },
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
  console.log("\nFærdig (v3). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
