// Seed v4: tøj-/lag-på-lag-klynge (uldundertøj, regntøj, vandresokker).
// Samme idempotente mønster som tidligere seeds. Kør: node seed_buying_guides_v4.mjs
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
  // ───────────────────────── ULDUNDERTØJ ─────────────────────────
  {
    slug: "uldundertoj",
    title: "Bedste uldundertøj 2026",
    category: "uldundertoj",
    seo_title: "Bedste uldundertøj 2026 – merino base layer til shelter | ShelterDK",
    seo_description: "Find det bedste uldundertøj til shelterture og friluftsliv. Vi scorer 7 favoritter — merino vs. syntetisk, vægt og pasform, fra budget til premium.",
    intro: "Uldundertøj er det vigtigste lag tættest på kroppen — det holder dig varm når du sover ude, og fugttransporterende når du går. Vi har scoret de bedste merino- og base-layer-trøjer til shelterture i dansk klima, fra budget til premium.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Woolmark – merino wool base layer guide", url: "https://www.woolmark.com/" },
      { title: "OutdoorGearLab – best base layers", url: "https://www.outdoorgearlab.com/topics/clothing-mens/best-base-layer" },
    ],
    faq: [
      { q: "Merino eller syntetisk undertøj?", a: "Merinould holder på varmen, lugter næsten ikke (du kan bruge det i flere dage) og føles behageligt mod huden — det bedste til shelterovernatning og rolige ture. Syntetisk er billigere, ekstremt slidstærkt og transporterer sved en anelse hurtigere ved høj puls — godt til intens vandring. Til de fleste shelterfolk vinder merino på komfort og lugtfrihed." },
      { q: "Hvilken vægt (g/m²) skal jeg vælge?", a: "Letvægt (~150 g/m²) er til aktiv brug og milde forhold; mellemvægt (~200-260 g/m²) er det alsidige valg til 3-sæsons shelterbrug; tung (~260+) er til vinter og stillesiddende kulde. Til en typisk forår/efterår-sheltertur i Danmark er mellemvægt det rigtige." },
      { q: "Kan man sove i sit uldundertøj?", a: "Ja — et tørt sæt uldundertøj er det ideelle sovetøj i shelter, fordi det isolerer og lader huden ånde. Husk reglen: skift ALTID til et tørt sæt før du kryber i soveposen — dagens svedige lag køler dig ned om natten." },
      { q: "Hvor ofte skal uldundertøj vaskes?", a: "Sjældnere end du tror. Merino er naturligt lugthæmmende og kan bruges flere dage i træk; luft det blot ud mellem brug. Vask koldt/skånsomt uden skyllemiddel, og undlæg tørretumbler — det forlænger levetiden markant." },
      { q: "Hvad koster godt uldundertøj?", a: "Et solidt sæt 100% merino ligger på 600-800 kr (trøje + bukser), enkeltdele fra ~400 kr. Syntetiske base layers og blandinger fås fra ~250 kr. Over ~1.000 kr betaler du mest for finere uld (mulesing-frit, lavere vægt) og brand." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige uldundertøj\n\nUndertøjet er **base layer** — laget tættest på huden i lag-på-lag-systemet. Dets job er at flytte sved væk fra kroppen og isolere, så du holder dig varm og tør. Til shelterbrug er det dobbelt vigtigt: det er både dit aktive lag om dagen og dit sovetøj om natten.\n\n## Merino vs. syntetisk\n\n**Merinould** er kongen til shelterliv: den isolerer selv let fugtig, føles blød mod huden, og — vigtigst — lugter næsten ikke, så du kan bære den i dagevis. **Syntetisk** (polyester/polypropylen) er billigere, mere slidstærkt og transporterer sved en smule hurtigere ved høj intensitet, men begynder at lugte hurtigt. Til rolige ture og overnatning vinder merino; til svedig bjergvandring kan syntetisk give mening.\n\n## Vægt og lag\n\nUld måles i g/m². **150 g/m²** er let og aktivt, **~200-260 g/m²** er det alsidige 3-sæsons-valg, og **260+** er til vinter. Et komplet sæt (trøje + lange underbukser) giver mest fleksibilitet — du kan tage underdelen af, hvis det bliver lunt.\n\n## Pasform\n\nBase layer skal sidde **tæt** (men ikke stramt) for at virke — luft mellem stof og hud transporterer ikke fugt. Vælg din normale størrelse, og se efter fladsyede sømme, der ikke gnaver under rygsækkens stropper.\n\n## Den vigtigste regel: sov tørt\n\nDet største begynder-fejltrin er at sove i dagens svedige undertøj. Selv merino køler, når det er fugtigt. Pak et ekstra, tørt sæt du KUN sover i — det er forskellen mellem en varm og en kold nat i shelteret.\n\n## Vores anbefaling\n\nTil de fleste: en mellemvægts 100% merino-trøje i 400-700 kr-klassen (vores testvinder er Treklifes 100% merino). Vil du have det komplette sæt med det samme, er uldundertøjssættet bedst værd for pengene. Går du hårdt til den, så overvej en syntetisk som Montane Dart.`,
    entries: [
      { product_id: "backpackerlife-371862", score: 8.7, award_label: "Bedst i test", best_for: "Alround merino base", editorial_note: "Treklifes 100% merino-undertrøje rammer sweet-spottet: ægte merino-komfort og lugtfrihed til en pris langt under de store mærker. Vores alround-favorit til shelterbrug.", pros: ["100% merino til skarp pris", "Lugthæmmende — brug i dagevis", "Behagelig mod huden"], cons: ["Mellemvægt — ikke til streng vinter alene", "Skal håndteres skånsomt i vask"], specs: { type: "100% merino", fyld: "merinould" } },
      { product_id: "backpackerlife-51594", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget / begynder", editorial_note: "Trespass Unite 360 er den billige vej ind i ordentligt base layer — en blanding der holder varmen og koster en brøkdel af ren merino.", pros: ["Lav pris", "Varm 360-vægt", "God til begynderen"], cons: ["Ikke ren merino — lugter hurtigere", "Tungere stof"], specs: { type: "base layer (blanding)" } },
      { product_id: "backpackerlife-812340", score: 8.4, award_label: "Bedste til høj aktivitet", best_for: "Intens vandring", editorial_note: "Montane Dart Zip Neck er syntetisk og bygget til at flytte sved hurtigt ved høj puls — med lynlås i halsen til hurtig ventilation. Til dig der går hårdt til den.", pros: ["Hurtig svedtransport", "Slidstærkt syntetisk", "Zip-neck til ventilation"], cons: ["Lugter hurtigere end uld", "Mindre varm i ro"], specs: { type: "syntetisk" } },
      { product_id: "backpackerlife-82136", score: 8.2, award_label: "Bedste lette merino", best_for: "Mild aktivitet", editorial_note: "Trespass' 100% merino-uldtrøje er et let, behageligt merino-lag til en overkommelig pris — fin som dagligt base layer i skuldersæsonen.", pros: ["100% merino, let", "God pris for ren uld", "Behagelig"], cons: ["Tyndere — mindre vinter-varme", "Enkel finish"], specs: { type: "100% merino" } },
      { product_id: "backpackerlife-51005", score: 8.6, award_label: "Bedste premium", best_for: "Kvalitet der holder", editorial_note: "Ulvang Rav er norsk merino-kvalitet i topklasse: blødt, holdbart og varmt — investeringen der holder i mange sæsoner.", pros: ["Fremragende merino-kvalitet", "Holdbar norsk konstruktion", "Varm og blød"], cons: ["Høj pris", "Kun trøjen — bukser separat"], specs: { type: "100% merino" } },
      { product_id: "backpackerlife-820284", score: 8.5, award_label: "Bedste komplette sæt", best_for: "Trøje + bukser samlet", editorial_note: "Uldundertøjssættet (100% merino) giver både overdel og underdel i ét køb — det mest komplette og prisvenlige hvis du starter fra bunden.", pros: ["Trøje + bukser i ét", "100% merino", "God samlet pris"], cons: ["Mindre brandprestige", "Fast farvevalg"], specs: { type: "100% merino sæt" } },
      { product_id: "backpackerlife-371868", score: 8.3, award_label: "Bedste underdel", best_for: "Lange underbukser", editorial_note: "Treklifes 100% merino-underbukser er den naturlige makker til trøjen — varme på ben og lænd de kolde nætter, og som sove-underdel i shelteret.", pros: ["100% merino", "Skarp pris", "God som sovetøj"], cons: ["Mellemvægt", "Skånevask"], specs: { type: "100% merino" } },
    ],
  },

  // ───────────────────────── REGNTØJ ─────────────────────────
  {
    slug: "regntoj",
    title: "Bedste regntøj 2026",
    category: "regntoj",
    seo_title: "Bedste regntøj 2026 – regnjakke & regnbukser til shelter | ShelterDK",
    seo_description: "Find det bedste regntøj til shelterture i dansk vejr. Vi scorer 7 favoritter — regnjakke, regnbukser, sæt og poncho, fra 149 til 349 kr.",
    intro: "I Danmark er regntøj ikke valgfrit — det er forskellen mellem en god og en elendig tur. Vi har scoret det bedste pakbare regntøj til shelterture: jakker, bukser, sæt og ponchoer der holder dig tør uden at fylde rygsækken.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "DMI – nedbør i Danmark", url: "https://www.dmi.dk/" },
      { title: "OutdoorGearLab – best rain jackets", url: "https://www.outdoorgearlab.com/topics/clothing-mens/best-rain-jacket-mens" },
    ],
    faq: [
      { q: "Hvad betyder vandsøjle, og hvor høj skal den være?", a: "Vandsøjlen måler hvor meget vandtryk stoffet holder ude. ~5.000 mm klarer let til moderat regn; 10.000+ mm holder til vedvarende regn og presset fra rygsækremme. Til shelterture i dansk vejr er 5.000-10.000 mm rigeligt for de fleste." },
      { q: "Regnjakke, regnsæt eller poncho?", a: "En regnjakke er minimum. Et regnsæt (jakke + bukser) holder dig tør hele vejen ned og er det rigtige til længere ture og vådt terræn. En poncho er let, billig og dækker også rygsækken, men flagrer i blæst — god som backup eller til stillesiddende lejrbrug." },
      { q: "Hvad er 'pakbart' regntøj?", a: "Pakbart regntøj kan foldes ned i sin egen lomme til størrelsen af en knytnæve, så det altid kan være i rygsækken uden at fylde. Til shelterbrug er det afgørende — du bærer det 'for en sikkerheds skyld' langt oftere end du bruger det." },
      { q: "Hvorfor bliver jeg våd indvendigt selv i regntøj?", a: "Det er kondens fra din egen sved, ikke utæthed. Åbn ventilationslynlåse, løsn manchetter, og undgå at gå for varmt påklædt. Åndbart stof og pit-zips hjælper, men intet regntøj er 100% kondensfrit ved høj aktivitet." },
      { q: "Hvad koster godt regntøj?", a: "Pakbart begynder-regntøj fås fra ~150 kr pr. del, et komplet sæt fra ~250 kr, og mere robust, åndbart regntøj fra ~350 kr. Til lejlighedsvis shelterbrug kommer du langt med et sæt til 250-350 kr." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige regntøj\n\nRegntøjet er dit **yderste skal-lag** — det der holder vind og regn ude, mens lagene indenunder holder varmen. I Danmark, hvor en tur sjældent slipper for byger, er det det stykke grej der oftest redder turen. Tre ting afgør valget: **vandtæthed**, **pakmål** og **om du vil dække ben og rygsæk**.\n\n## Vandsøjle og åndbarhed\n\nVandsøjlen (mm) fortæller hvor meget regn stoffet holder ude: 5.000 mm til let/moderat, 10.000+ til vedvarende regn og rygsæk-pres. Men vandtæthed alene gør dig svedig — **åndbarhed** (og ventilationslynlåse) lader fugt slippe ud. Til shelterbrug er en balance i mellemklassen det rigtige; ekspeditions-membraner er overkill.\n\n## Jakke, sæt eller poncho\n\n- **Regnjakke:** minimum og det mest alsidige. Vælg en med hætte der kan justeres.\n- **Regnsæt (jakke + bukser):** holder dig tør hele vejen ned — det rigtige til længere ture, vådt græs og blæst. Bedst værdi pr. tør centimeter.\n- **Poncho:** let, billig, dækker også rygsækken, men flagrer i vind. God backup eller til lejren.\n\n## Pakmål er afgørende\n\nDu bærer regntøj langt oftere end du bruger det — derfor skal det være **pakbart** (foldes ned i egen lomme). Et sæt der fylder som en knytnæve kommer altid med; et der fylder en sweater bliver hjemme den dag du får brug for det.\n\n## Pas på kondens\n\nFølelsen af at være våd indeni er som regel din egen sved, ikke utæthed. Brug ventilationslynlåse, undgå at gå for varmt påklædt, og acceptér at intet regntøj er kondensfrit ved høj puls. Et tyndt base layer (se vores [uldundertøj-guide](/bedste/uldundertoj)) under skallen flytter fugten væk.\n\n## Vores anbefaling\n\nTil de fleste: et pakbart sæt i 250-350 kr — vores testvinder er Treklife Rain Packaway, der dækker både jakke og bukser kompakt. Skal du bruge minimum, så start med en regnjakke; og hav evt. en billig poncho som backup til lejren.`,
    entries: [
      { product_id: "backpackerlife-381333", score: 8.6, award_label: "Bedst i test", best_for: "Alround regnjakke", editorial_note: "Treklife Rain Packaway-jakken er let, vandtæt og pakker ned i sin egen lomme — den jakke der altid kan være i rygsækken til en skarp pris. Vores alround-vinder.", pros: ["Pakker mikroskopisk", "God vandsøjle til prisen", "Justerbar hætte"], cons: ["Basal åndbarhed", "Tynd til hård slid"], specs: { type: "regnjakke, pakbar" } },
      { product_id: "backpackerlife-394566", score: 8.7, award_label: "Bedste value (sæt)", best_for: "Tør hele vejen ned", editorial_note: "Rain Packaway-regnsættet giver både jakke og bukser pakbart i ét køb — bedst værdi hvis du vil holdes helt tør uden at samle delene hver for sig.", pros: ["Jakke + bukser i ét", "Begge pakbare", "Stærk samlet pris"], cons: ["Simpel pasform", "Mellem åndbarhed"], specs: { type: "regnsæt, pakbar" } },
      { product_id: "backpackerlife-65404", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget-regnjakke", editorial_note: "Highlander Stormguard Stowaway er en pålidelig, pakbar budget-jakke der holder regnen ude på den korte tur — uden den store regning.", pros: ["Lav pris", "Pakbar", "Robust nok til lejlighedsbrug"], cons: ["Tungere stof", "Mindre åndbar"], specs: { type: "regnjakke, pakbar" } },
      { product_id: "backpackerlife-49106", score: 8.3, award_label: "Bedste pakbare", best_for: "Mindst pakmål", editorial_note: "Trespass Qikpac er kendt for at pakke ned til næsten ingenting — den unisex-jakke du glemmer du har med, indtil regnen kommer.", pros: ["Ekstremt lille pakmål", "Let", "Unisex pasform"], cons: ["Tyndt stof", "Enkel hætte"], specs: { type: "regnjakke, pakbar" } },
      { product_id: "backpackerlife-16267", score: 8.2, award_label: "Bedste robuste", best_for: "Hårdere brug", editorial_note: "Highlander Stow&Go er en kraftigere vandtæt jakke til dig der vil have lidt mere stof og holdbarhed mod gren og slid — stadig pakbar.", pros: ["Mere robust stof", "God vandtæthed", "Stadig pakbar"], cons: ["Tungere og større", "Højere pris"], specs: { type: "vandtæt jakke" } },
      { product_id: "backpackerlife-381367", score: 8.1, award_label: "Bedste regnbukser", best_for: "Tørre ben", editorial_note: "Rain Packaway-regnbukserne er den oversete halvdel — våde ben fra højt græs ødelægger turen. Pakbare og lette at tage på over støvlerne.", pros: ["Pakbare", "Lette at tage på", "Skarp pris"], cons: ["Ingen fuld sidelynlås", "Basal pasform"], specs: { type: "regnbukser, pakbar" } },
      { product_id: "backpackerlife-8637", score: 7.6, award_label: "Bedste poncho", best_for: "Backup / lejr", editorial_note: "Ralka-regnponchoen dækker både dig og rygsækken og fylder ingenting — den billige backup der bor permanent i sidelommen.", pros: ["Dækker også rygsækken", "Meget billig", "Fylder intet"], cons: ["Flagrer i blæst", "Ingen pasform"], specs: { type: "poncho" } },
    ],
  },

  // ───────────────────────── VANDRESOKKER ─────────────────────────
  {
    slug: "vandresokker",
    title: "Bedste vandresokker 2026",
    category: "sokker",
    seo_title: "Bedste vandresokker 2026 – merino uld til vandring | ShelterDK",
    seo_description: "Find de bedste vandresokker til shelterture og vandring. Vi scorer 6 favoritter i merinould — liner, hiker og vinter, fra 99 til 149 kr.",
    intro: "Gode vandresokker er billig forsikring mod vabler og kolde fødder — og de fleste undervurderer dem. Vi har scoret de bedste merino-vandresokker til shelterture: fra tynde liners til varme vintersokker.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best hiking socks", url: "https://www.outdoorgearlab.com/topics/shoes-and-boots/best-hiking-socks" },
    ],
    faq: [
      { q: "Hvorfor merinould i vandresokker?", a: "Merino transporterer fugt, isolerer selv fugtig, polstrer mod gnav og — vigtigst — lugter næsten ikke, så samme par holder flere dage. Bomuld gør det modsatte: suger vand til sig og giver vabler. Til vandring og shelter er uld næsten altid det rigtige." },
      { q: "Hvad er en sok-liner, og skal jeg bruge en?", a: "En liner er en tynd inder-sok der bæres under den egentlige vandresok. Den flytter friktionen fra hud-mod-sok til sok-mod-sok og reducerer vabler markant på lange ture. Mange klarer sig fint uden, men er du vabel-tilbøjelig, er to-lags-systemet guld værd." },
      { q: "Hvor mange par skal jeg have med på sheltertur?", a: "Tommelfingerregel: ét par på fødderne, ét tørt i reserve, og evt. et tyndt par at sove i. Merino kan bæres flere dage, så du behøver ikke ét par pr. dag — men tørre sovesokker er ren luksus i shelteret." },
      { q: "Hvordan undgår jeg vabler?", a: "Tre ting: uldsokker (ikke bomuld), korrekt passende sko, og at skifte til tørre sokker så snart fødderne bliver våde. Mærker du et 'hot spot', så stop og sæt tape på med det samme — vent ikke til vablen er der." },
      { q: "Hvad koster gode vandresokker?", a: "Ordentlige merino-vandresokker koster 100-150 kr pr. par; liners lidt mindre. 3-pak giver typisk bedre pris pr. par. Det er en lille udgift med stor effekt på komforten." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du de rigtige vandresokker\n\nSokken er det mest oversete stykke grej — og det der oftest ødelægger en tur, hvis den er forkert. Den rigtige sok holder foden tør, polstrer mod gnav og forebygger vabler. Materialet er det vigtigste valg: **merinould slår bomuld hver gang** til friluftsbrug.\n\n## Hvorfor uld, aldrig bomuld\n\nBomuld suger sved og regn til sig, bliver koldt og vådt, og giver vabler. **Merinould** transporterer fugt væk, isolerer selv fugtig, polstrer blødt og lugter næsten ikke — du kan bære samme par i dagevis. Det er hele grunden til at uldsokker er friluftsstandarden.\n\n## Tykkelse og brug\n\n- **Liner / tynd:** til varmt vejr, høj aktivitet, eller som inderlag i et to-lags-system mod vabler.\n- **Hiker / mellem:** det alsidige valg til 3-sæsons shelterture — polstring uden at koge fødderne.\n- **Vinter / tyk:** ekstra varme til kolde nætter og vinterture.\n\n## To-lags-systemet mod vabler\n\nEr du vabel-tilbøjelig, så bær en tynd **liner** under den egentlige sok. Friktionen flytter sig fra din hud til mellem de to lag — en gammel militær- og langdistance-vandrer-fidus, der virker.\n\n## Tørre sovesokker\n\nPak et tyndt, tørt par du KUN bruger i soveposen. Ligesom med undertøj gælder det: dagens svedige sokker køler dig om natten. Tørre fødder = varm søvn i shelteret.\n\n## Vores anbefaling\n\nTil de fleste: et par mellemtykke merino-vandresokker (vores testvinder er Treklife Wool Hiker). Er du vabel-tilbøjelig, så tilføj et par tynde liners. Og pak altid ét tørt reservepar.`,
    entries: [
      { product_id: "backpackerlife-526028", score: 8.6, award_label: "Bedst i test", best_for: "Alround vandring", editorial_note: "Treklife Wool Hiker er den alsidige merino-vandresok: nok polstring til lange dage, god fugttransport og en pris der gør det nemt at have flere par. Vores favorit.", pros: ["Merino — varm og lugtfri", "God polstring", "Skarp pris"], cons: ["Mellemtyk — varm om sommeren", "Enkelt design"], specs: { type: "merino, mellemtyk" } },
      { product_id: "backpackerlife-526024", score: 8.3, award_label: "Bedste liner", best_for: "To-lags / varmt vejr", editorial_note: "Treklife Wool Liner er den tynde inder-sok til to-lags-systemet eller varme dage — flytter friktionen væk fra huden og forebygger vabler.", pros: ["Tynd og let", "God som vabel-liner", "Merino"], cons: ["Lidt polstring", "Ikke til kulde alene"], specs: { type: "merino liner" } },
      { product_id: "backpackerlife-99181", score: 8.0, award_label: "Bedst til prisen", best_for: "Budget", editorial_note: "Highlander Crusader er en solid uldblandings-vandresok til den laveste pris i testen — fin hverdagssok til turen uden at tænke over det.", pros: ["Lav pris", "Robust", "Fin polstring"], cons: ["Uldblanding — lugter lidt før", "Tykkere stof"], specs: { type: "uldblanding" } },
      { product_id: "backpackerlife-99324", score: 8.1, award_label: "Bedste til støvler", best_for: "Høje støvler", editorial_note: "Highlander Combat Sock i uld er den høje, polstrede sok til vandrestøvler — beskytter lægben og ankel mod støvlekanten på lange dage.", pros: ["Høj — beskytter mod støvlekant", "God polstring", "Uld"], cons: ["For varm til sko/sommer", "Tyk"], specs: { type: "uld, høj" } },
      { product_id: "backpackerlife-46071", score: 8.4, award_label: "Bedste til vinter", best_for: "Kolde nætter", editorial_note: "Norwegian Army 80% uld er den klassiske tykke, varme militærsok — uovertruffen til kolde nætter i shelteret og vinterture.", pros: ["Meget varm (80% uld)", "Robust militærkvalitet", "God til vinter"], cons: ["For varm om sommeren", "Tyk i skoen"], specs: { type: "80% uld, tyk" } },
      { product_id: "backpackerlife-617206", score: 8.2, award_label: "Bedste tynde liner", best_for: "Letvægt sommer", editorial_note: "Ulvang Liner er en kvalitets-liner fra et stærkt norsk uldmærke — tynd, let og perfekt under en tykkere sok eller solo i varmen.", pros: ["Kvalitetsmærke (Ulvang)", "Meget tynd og let", "God svedtransport"], cons: ["Minimal polstring", "Pris pr. tykkelse"], specs: { type: "merino liner" } },
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
  console.log("\nFærdig (v4). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
