// Seed v6: trail-klynge (vandrestøvler & vandresko, dry bag, kompas, gamacher).
// Samme idempotente mønster som tidligere seeds. Kør: node seed_buying_guides_v6.mjs
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
  // ───────────────── VANDRESTØVLER & VANDRESKO ─────────────────
  {
    slug: "vandrestovler",
    title: "Bedste vandrestøvler & vandresko 2026",
    category: "fodtoj",
    seo_title: "Bedste vandrestøvler & vandresko 2026 – til shelter & vandring | ShelterDK",
    seo_description: "Find de bedste vandrestøvler og vandresko til shelterture og vandring. Vi scorer 7 favoritter — low-cut, mid-cut, GTX og tactical, fra 599 til 1499 kr.",
    intro: "Fodtøjet er det vigtigste stykke grej på vandreturen — våde eller ømme fødder ødelægger alt andet. Vi har scoret de bedste vandrestøvler og vandresko til danske shelterture: fra lette low-cut-sko til vandtætte mid-cut-støvler, i både herre- og dame-modeller.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best hiking boots", url: "https://www.outdoorgearlab.com/topics/shoes-and-boots/best-hiking-boots" },
      { title: "Merrell – Moab fit & technology", url: "https://www.merrell.com/" },
    ],
    faq: [
      { q: "Vandresko (low-cut) eller vandrestøvle (mid-cut)?", a: "Low-cut vandresko er lette, luftige og hurtige at gå i — godt til dagsture, tørt terræn og pakkere der vil spare vægt. Mid-cut støvler støtter anklen og holder bedre på sten, rødder og i vådt/ujævnt terræn med tung rygsæk. Til de fleste danske shelterture med en pakket rygsæk er en mid-cut det sikre valg; går du let og hurtigt, vinder skoen." },
      { q: "Hvad betyder GTX / Gore-Tex, og har jeg brug for det?", a: "GTX (Gore-Tex) er en vandtæt, åndbar membran — den holder fødderne tørre i regn og vådt græs, men gør skoen en smule varmere og langsommere at tørre, hvis den først bliver våd indeni. I dansk klima med dug og byger er en vandtæt (GTX/Texapore) model næsten altid det rigtige; til tørre sommerture kan en ikke-membran sko ånde bedre." },
      { q: "Hvilken størrelse skal jeg vælge til vandrestøvler?", a: "Køb en halv til en hel størrelse større end dine bysko. Fødderne hæver på lange dage, og tæerne skal have plads, så de ikke rammer fronten på nedstigninger — den hurtigste vej til sorte negle. Prøv altid med de vandresokker du vil bruge, og snør godt over vristen så hælen ikke glider." },
      { q: "Skal nye vandrestøvler gås til?", a: "Moderne syntetiske sko og lette mid-cut-støvler kræver minimal tilvænning og kan ofte bruges næsten med det samme. Stive læderstøvler skal derimod gås til over flere kortere ture, før den store tur — ellers risikerer du vabler. Tag aldrig helt nye, ugåede læderstøvler med på en flerdagstur." },
      { q: "Hvordan undgår jeg vabler i vandrestøvler?", a: "Rigtig pasning (plads til tæerne, fast hæl), ordentlige uld-vandresokker — aldrig bomuld — og at skifte til tørre sokker så snart fødderne bliver fugtige. Mærker du et 'hot spot', så stop og sæt tape eller vabelplaster på med det samme. Se også vores [vandresokker-guide](/bedste/vandresokker)." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige vandrefodtøj\n\nFødderne bærer dig — og hele rygsækken — gennem turen, så fodtøjet er det stykke grej hvor det betaler sig mest at vælge rigtigt. Tre ting afgør valget: **højde** (low-cut sko vs. mid-cut støvle), **vandtæthed** (membran eller ej) og **pasform**. Resten er finish og brand.\n\n## Sko eller støvle\n\n- **Low-cut vandresko:** lette, luftige og hurtige — det rigtige til dagsture, tørt terræn og letvægts-pakkere. Mindre ankelstøtte.\n- **Mid-cut vandrestøvle:** støtter anklen, beskytter mod sten og rødder, og holder bedre i vådt og ujævnt terræn med tung rygsæk. Det sikre alround-valg til danske shelterture.\n\nTommelfingerregel: jo tungere rygsæk og jo mere ujævnt terræn, jo højere skaft.\n\n## Vandtæthed: GTX/Texapore\n\nI Danmark, hvor dug og byger er reglen, er en **vandtæt membran** (Gore-Tex/GTX eller Jack Wolfskins Texapore) næsten altid det rigtige — den holder fødderne tørre i vådt græs og regn. Bagsiden: membranen gør skoen lidt varmere og langsommere at tørre, hvis den først bliver våd indeni. Til tørre højsommerture kan en ikke-membran model ånde bedre.\n\n## Pasform er alt\n\nKøb en halv til en hel størrelse op, prøv med dine [vandresokker](/bedste/vandresokker), og sørg for at tæerne har plads mens hælen sidder fast. En sko der passer perfekt i butikken men presser tæerne på en nedstigning, giver sorte negle og vabler. Gå stive læderstøvler til over flere korte ture før den store tur.\n\n## Materiale: syntetisk vs. læder\n\n**Syntetiske** sko/støvler er lette, kræver lidt tilvænning og tørrer hurtigt — det moderne standardvalg. **Læder** er mere holdbart og vandafvisende over tid, men tungere, dyrere og kræver indgåing og pleje. Til de fleste er en syntetisk mid-cut det bedste køb.\n\n## Vores anbefaling\n\nTil de fleste: Merrell Moab Mid GTX — verdens mest solgte vandrestøvle af en grund: pasform, komfort og vandtæthed der bare virker. Vil du spare, er Treklife Hiker stærkt værd for pengene; vil du gå let og hurtigt, så vælg en low-cut som Moab Speed. Alle modeller fås i både herre- og dame-pasform.`,
    entries: [
      { product_id: "backpackerlife-365680", score: 8.8, award_label: "Bedst i test", best_for: "Alround mid-cut", editorial_note: "Merrell Moab Mid GTX er verdens bestseller af en grund: prøv-og-passer-pasform, god dæmpning, Vibram-greb og pålidelig Gore-Tex-vandtæthed. Vores alround-vinder til shelterture — fås i herre og dame.", pros: ["Fremragende pasform ud af æsken", "Vandtæt GTX-membran", "Vibram-såler med godt greb"], cons: ["Membran gør den lidt varm", "Ikke den letteste"], specs: { type: "mid-cut støvle", membran: "Gore-Tex", materiale: "syntetisk/læder" } },
      { product_id: "backpackerlife-205488", score: 8.3, award_label: "Bedst til prisen", best_for: "Budget mid-cut", editorial_note: "Treklife Hiker mid-cut er den prisvenlige vej til en ordentlig vandrestøvle: ankelstøtte og vandafvisning til en brøkdel af mærkevarernes pris. Mest støvle for pengene — herre og dame.", pros: ["Lav pris for en mid-cut", "God ankelstøtte", "Egen-brand value"], cons: ["Mindre brandprestige", "Basal membran"], specs: { type: "mid-cut støvle", materiale: "syntetisk" } },
      { product_id: "backpackerlife-382747", score: 8.2, award_label: "Bedste vandresko", best_for: "Lette dagsture", editorial_note: "Jack Wolfskin Refugio Texapore Low er den prisvenlige low-cut vandresko: vandtæt Texapore-membran og komfortabel pasform til dagsture og lette pakkere. Godt indstegsvalg — herre og dame.", pros: ["Vandtæt Texapore til skarp pris", "Let og luftig", "Komfortabel til dagsture"], cons: ["Mindre ankelstøtte", "Ikke til tung rygsæk"], specs: { type: "low-cut sko", membran: "Texapore", materiale: "syntetisk" } },
      { product_id: "backpackerlife-374394", score: 8.5, award_label: "Bedste lette", best_for: "Fast & light", editorial_note: "Merrell Moab Speed 2 GTX er den lette, fjedrende vandresko til dig der går hurtigt: trail-runner-følelse med vandtæthed og Moab-pasform. Til letvægts-pakkere og raske dagsmarcher.", pros: ["Meget let og responsiv", "Vandtæt GTX", "God til hurtigt tempo"], cons: ["Mindre beskyttelse end støvle", "Slidsåle holder kortere"], specs: { type: "low-cut sko", membran: "Gore-Tex", materiale: "syntetisk" } },
      { product_id: "backpackerlife-913131", score: 8.4, award_label: "Bedste til teknisk terræn", best_for: "Klipper & stejlt", editorial_note: "La Sportiva Ultra Raptor 3 er bjerg- og trailløber-kvalitet: aggressivt greb og præcis pasform til teknisk, stejlt og stenet terræn. Til dig der søger udfordringen — herre og dame.", pros: ["Fremragende greb på klipper", "Præcis, sportslig pasform", "Holdbar konstruktion"], cons: ["Højere pris", "Stivere end en blød sko"], specs: { type: "trail-sko", materiale: "syntetisk" } },
      { product_id: "backpackerlife-58886", score: 8.0, award_label: "Bedste robuste", best_for: "Hård brug / budget", editorial_note: "Mil-Tec Tactical Boot er den robuste, billige arbejdshest: høj, kraftig og slidstærk til lejrarbejde, mudder og terræn hvor du ikke skåner støvlen. Tactical-look, lav pris.", pros: ["Meget lav pris", "Robust og høj", "Slidstærk til hård brug"], cons: ["Tungere og stivere", "Mindre teknisk åndbarhed"], specs: { type: "tactical støvle", materiale: "syntetisk/læder" } },
      { product_id: "backpackerlife-514947", score: 8.4, award_label: "Bedste premium", best_for: "Komfort & holdbarhed", editorial_note: "ECCO Offroad Boot er dansk-designet premium: blødt læder, ECCO's kendte komfort og en holdbarhed der bærer mange sæsoner. Investeringen for dig der prioriterer komfort over gram.", pros: ["Fremragende læderkomfort", "Holdbar kvalitet", "Dansk brand-design"], cons: ["Høj pris", "Læder kræver pleje og indgåing"], specs: { type: "mid-cut støvle", materiale: "læder" } },
    ],
  },

  // ───────────────────── DRY BAG / TØRSÆK ─────────────────────
  {
    slug: "dry-bag",
    title: "Bedste dry bag & tørsæk 2026",
    category: "drybag",
    seo_title: "Bedste dry bag 2026 – vandtæt tørsæk til shelter, kano & kajak | ShelterDK",
    seo_description: "Find den bedste dry bag og tørsæk til shelterture, kano og kajak. Vi scorer 7 favoritter — fra 1 til 20 liter, budget til Sea to Summit, 39 til 449 kr.",
    intro: "En dry bag er billig forsikring for dit grej: den holder sovepose, tøj og elektronik knastørt, selv når rygsækken bliver gennemblødt eller kanoen kæntrer. Vi har scoret de bedste tørsække til shelter, kano og kajak — fra små elektronik-poser til store, robuste padle-sække.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Sea to Summit – dry bag range", url: "https://seatosummit.com/" },
      { title: "Paddling.com – dry bag basics", url: "https://paddling.com/" },
    ],
    faq: [
      { q: "Hvor stor en dry bag skal jeg vælge?", a: "Det afhænger af hvad den skal beskytte. 1-4 liter til elektronik, dokumenter og småting; 8-13 liter til en sovepose eller skiftetøj; 20+ liter som hovedsæk i kano/kajak eller til at samle hele lejrgrejet. Mange bruger flere små frem for én stor — det gør det lettere at organisere og pakke rygsækken." },
      { q: "Hvordan lukker man en dry bag rigtigt?", a: "Pres luften ud, rul toppen ned mindst 3-4 gange, og spænd så clipsen. Det er rulningen — ikke clipsen — der gør sækken vandtæt, så jo flere rul, jo bedre forsegling. Pak ikke sækken helt fuld; du skal kunne rulle toppen ned med god margin." },
      { q: "Er en dry bag 100% vandtæt eller kun vandafvisende?", a: "En korrekt rullet og lukket dry bag holder vand ude ved regn, stænk og kortvarig nedsænkning — fx hvis den falder i vandet. Den er dog ikke en dykkertaske: holdes den under vand i lang tid eller under tryk, kan vand sive ind ved sømme og lukning. Til kano, kajak og regn er den rigeligt vandtæt." },
      { q: "Kan en dry bag bruges som kompressionssæk?", a: "Nogle modeller (fx Sea to Summit Evac) har en ventil og kompressionsstropper, så du både holder grejet tørt OG presser luften ud af fx soveposen for at spare plads. En almindelig dry bag komprimerer ikke — den holder bare tør. Skal den spare plads til dunsovepose, så vælg en kompressions-model." },
      { q: "Letvægts- eller robust dry bag?", a: "Letvægts-sække (tynd nylon/silnylon som Ultra-Sil) vejer næsten intet og er ideelle inde i rygsækken, hvor de ikke udsættes for slid. Robuste sække i kraftig PVC/TPU (fx Big River) tåler at blive smidt i bunden af en kano, trukket over sten og brugt som hovedbagage. Vælg efter hvor hårdt grejet bliver behandlet." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige dry bag\n\nEn dry bag (tørsæk) har én opgave: at holde dit grej tørt, uanset hvad vejret eller vandet finder på. Det er en af de billigste forsikringer du kan købe — en våd sovepose kan ødelægge en hel tur. Tre ting afgør valget: **størrelse**, **letvægt vs. robusthed**, og om du har brug for **kompression**.\n\n## Sådan virker den\n\nVandtætheden kommer fra rulningen, ikke clipsen: pres luften ud, rul toppen ned 3-4 gange og spænd. En korrekt lukket dry bag holder vand ude ved regn, stænk og kortvarig nedsænkning — perfekt til kano, kajak og en gennemblødt rygsæk. Pak den ikke helt fuld; du skal kunne rulle toppen ned med margin.\n\n## Størrelser og brug\n\n- **1-4 liter:** elektronik, telefon, dokumenter, førstehjælp — de ting der ALDRIG må blive våde.\n- **8-13 liter:** sovepose, tørt skiftetøj, sovetøj.\n- **20+ liter:** hovedsæk i kano/kajak, eller til at samle hele lejrgrejet.\n\nMange foretrækker **flere små** frem for én stor — det gør pakningen organiseret og holder de våde og tørre ting adskilt.\n\n## Letvægt vs. robust\n\n**Letvægts-sække** (silnylon som Sea to Summit Ultra-Sil) vejer næsten intet og er ideelle inde i rygsækken. **Robuste sække** i kraftig TPU/PVC (Big River) tåler at blive trukket over sten, smidt i kanoen og brugt som hovedbagage. Vælg efter hvor hårdt grejet behandles.\n\n## Kompression: spar plads\n\nNogle modeller (Sea to Summit Evac) kombinerer tørsæk og kompressionssæk: en luftventil og stropper lader dig presse luften ud af fx soveposen, så den fylder mindre. Skal din dunsovepose pakkes lille OG holdes tør, er en kompressions-dry-bag to ting i én.\n\n## Vores anbefaling\n\nTil de fleste: en 8-liters basis-dry-bag til soveposen plus en lille 1-2 liters til elektronik. Vil du spare vægt og plads, så vælg Sea to Summit Ultra-Sil eller Evac. Padler du meget, er Big River den robuste der holder til kano-livet. Et 3-pak sæt er den nemme måde at komme i gang med flere størrelser på én gang.`,
    entries: [
      { product_id: "backpackerlife-856", score: 8.6, award_label: "Bedst i test", best_for: "Alround sovepose-sæk", editorial_note: "8-liters basis-dry-bag rammer sweet-spottet: stor nok til en sovepose eller en dags skiftetøj, lille nok til at passe i enhver rygsæk, til en pris hvor du roligt køber to. Vores alround-favorit.", pros: ["Perfekt alround-størrelse", "Lav pris", "Rul-luk holder tørt"], cons: ["Basis-materiale — ikke til hård slid", "Ingen kompression"], specs: { type: "dry bag", volumen: "8 L", konstruktion: "standard" } },
      { product_id: "backpackerlife-44680", score: 8.2, award_label: "Bedste lille", best_for: "Elektronik & værdisager", editorial_note: "1-liters dry bag er den lille livline til telefon, powerbank og dokumenter — de ting der aldrig må blive våde. Vejer intet og bør altid være i rygsækken.", pros: ["Beskytter elektronik", "Vejer næsten intet", "Meget billig"], cons: ["Kun til småting", "Standard-materiale"], specs: { type: "dry bag", volumen: "1 L", konstruktion: "standard" } },
      { product_id: "backpackerlife-166291", score: 8.3, award_label: "Bedste letvægt (budget)", best_for: "Gram-tællere på budget", editorial_note: "5-liters letvægts-dry-bag er den tynde, lette sæk til dig der vil spare gram uden at betale Sea to Summit-pris — fin til skiftetøj og inderorganisering.", pros: ["Let og kompakt", "God pris for letvægt", "Fin organiseringsstørrelse"], cons: ["Tyndt materiale", "Mindre robust"], specs: { type: "dry bag", volumen: "5 L", konstruktion: "letvægt" } },
      { product_id: "backpackerlife-293800", score: 8.7, award_label: "Bedste premium-letvægt", best_for: "Ultralet kvalitet", editorial_note: "Sea to Summit Ultra-Sil 8L er letvægts-klassikeren: ekstremt let silnylon med pålidelig rul-luk og kvaliteten der holder. Standardvalget for ultralette pakkere.", pros: ["Ekstremt let silnylon", "Pålidelig kvalitet", "Pakker selv småt"], cons: ["Højere pris", "Tyndt — beskyt mod skarpe kanter"], specs: { type: "dry bag", volumen: "8 L", konstruktion: "letvægt premium" } },
      { product_id: "backpackerlife-613197", score: 8.5, award_label: "Bedste med kompression", best_for: "Pak soveposen lille", editorial_note: "Sea to Summit Evac 8L er to ting i én: tørsæk OG kompressionssæk med luftventil, så du presser luften ud af soveposen og sparer plads. Genial til dunsoveposer.", pros: ["Holder tør + komprimerer", "Luftventil sparer plads", "Kvalitetskonstruktion"], cons: ["Dyrere end basis", "Lidt tungere end ren letvægt"], specs: { type: "dry bag", volumen: "8 L", konstruktion: "kompression" } },
      { product_id: "backpackerlife-483820", score: 8.4, award_label: "Bedste robuste", best_for: "Kano & kajak", editorial_note: "Sea to Summit Big River 20L er den kraftige TPU-sæk til padle-livet: tåler at blive trukket over sten, smidt i kanoen og brugt som hovedbagage. Robust nok til det hårde.", pros: ["Meget robust TPU", "Stor 20 L kapacitet", "Til kano/kajak-brug"], cons: ["Tungere end letvægt", "Højere pris"], specs: { type: "dry bag", volumen: "20 L", konstruktion: "robust TPU" } },
      { product_id: "backpackerlife-223584", score: 8.1, award_label: "Bedste sæt", best_for: "Flere størrelser i ét", editorial_note: "Dry bag-sæt med 3 stk i forskellige størrelser er den nemme indgang: organiser hele rygsækken og hold vådt og tørt adskilt — alle størrelser i ét køb.", pros: ["3 størrelser i ét køb", "God til organisering", "Bedst værdi pr. sæk"], cons: ["Standard-materiale", "Ikke letvægts-optimeret"], specs: { type: "dry bag sæt", volumen: "3 stk", konstruktion: "standard" } },
    ],
  },

  // ───────────────────── KOMPAS & NAVIGATION ─────────────────────
  {
    slug: "kompas",
    title: "Bedste kompas 2026",
    category: "kompas",
    seo_title: "Bedste kompas 2026 – navigation til vandring & shelter | ShelterDK",
    seo_description: "Find det bedste kompas til vandring og friluftsliv. Vi scorer 6 favoritter — baseplade, sigtekompas og spejlkompas, fra Highlander til Silva, 49 til 329 kr.",
    intro: "Et kompas vejer intet, kræver hverken batteri eller signal, og kan redde turen når telefonen dør eller stien forsvinder. Vi har scoret de bedste kompasser til vandring og shelterliv — fra billige baseplade-kompasser til klassikeren Silva, sammen med kort og en smule øvelse.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Silva – how to use a compass", url: "https://silva.se/" },
      { title: "Friluftsrådet – kort og kompas", url: "https://friluftsraadet.dk/" },
    ],
    faq: [
      { q: "Hvilken type kompas skal jeg vælge?", a: "Til vandring er et baseplade-kompas (gennemsigtig plade med roterende kapsel) standardvalget — det lægges direkte på kortet og er let at tage kurser med. Et sigtekompas (med kighul eller spejl) giver mere præcis pejling af fjerne punkter og bruges til mere avanceret terræn-navigation. Til de fleste shelterfolk er et godt baseplade-kompas rigeligt." },
      { q: "Hvad er deklination, og skal jeg bekymre mig om det?", a: "Deklination er forskellen mellem geografisk nord (kortet) og magnetisk nord (kompasnålen). I Danmark er den lille (få grader) og betyder lidt på korte ture. På lange ruter eller i udlandet kan den give afvigelser — der vælger du et kompas med justerbar deklination (fx Silva Ranger), så du kan stille forskellen permanent." },
      { q: "Kan jeg ikke bare bruge telefonens GPS?", a: "GPS er fremragende — lige indtil batteriet dør, skærmen knuses, eller du mister signal i en dal. Et kompas er backup'en der altid virker: ingen strøm, ingen netværk, ingen skærm i regnen. Den kloge tager begge dele med og kan grundlæggende kort-og-kompas, hvis teknikken svigter." },
      { q: "Hvad skal jeg ud over kompasset for at navigere?", a: "Et kompas alene er begrænset — du skal have et kort over området og kunne grundlæggende kortlæsning: orientere kortet, tage en kurs, og følge den. Mange kompasser har lup og målestok til netop det. Øv dig i kendt terræn først, så teknikken sidder, når du får brug for den." },
      { q: "Hvad gør et godt vandrekompas dyrere?", a: "De billige kompasser (49-99 kr) navigerer fint på korte ture. Mere betaler for: væskedæmpet kapsel der falder hurtigt til ro, justerbar deklination, lysende markører til mørke, spejl/sigte til præcision og en holdbar konstruktion. Silva-modellerne er standarden, fordi de gør alt dette pålideligt." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige kompas\n\nEt kompas er det mest lavpraktiske stykke sikkerhedsgrej du kan eje: det vejer intet, koster lidt, og virker når alt elektronisk svigter. Men et kompas navigerer ikke for dig — det kræver et **kort** og en smule **øvelse**. Vælg type efter hvor avanceret din navigation skal være.\n\n## Typer af kompas\n\n- **Baseplade-kompas:** den gennemsigtige plade med roterende kapsel, der lægges direkte på kortet. Let at tage kurser med — standardvalget til vandring.\n- **Sigtekompas (kighul/lensatic):** giver præcis pejling af fjerne punkter, robust militær-stil.\n- **Spejlkompas:** kombinerer sigte og baseplade — du pejler et fjernt punkt og aflæser kursen samtidig. Mest præcist til avanceret terræn-navigation.\n\n## Deklination\n\nDeklination er forskellen mellem geografisk og magnetisk nord. I Danmark er den lille og betyder lidt på korte ture. Skal du langt eller i udlandet, så vælg et kompas med **justerbar deklination** (Silva Ranger), så du kan stille forskellen permanent og slippe for hovedregning undervejs.\n\n## Kompas vs. GPS\n\nGPS på telefonen er fremragende — indtil batteriet dør, skærmen knuses eller signalet forsvinder. Et kompas er backup'en der **altid virker**: ingen strøm, intet netværk. Tag begge dele med, og lær grundlæggende kort-og-kompas, så du kan klare dig hvis teknikken svigter.\n\n## Lær det i kendt terræn\n\nKøb kompasset OG øv dig, før du får brug for det. Orientér kortet, tag en kurs, følg den — i en kendt skov hvor en fejl ikke koster. Når teknikken sidder, er kort og kompas en ro i baghovedet på enhver tur.\n\n## Vores anbefaling\n\nTil de fleste: Silva 3NL-360 — den klassiske baseplade-standard, væskedæmpet og pålidelig, som spejdere og friluftsfolk har brugt i generationer. Skal det bare være billigt og med, gør Highlander Map-kompasset jobbet på den korte tur. Vil du have det bedste med justerbar deklination, så vælg Silva Ranger S.`,
    entries: [
      { product_id: "backpackerlife-72729", score: 8.7, award_label: "Bedst i test", best_for: "Alround baseplade", editorial_note: "Silva 3NL-360 er den klassiske baseplade-standard: væskedæmpet kapsel der hurtigt falder til ro, klar målestok og den pålidelighed Silva er kendt for. Vores alround-vinder til vandring.", pros: ["Væskedæmpet — falder hurtigt til ro", "Pålidelig Silva-kvalitet", "God baseplade til kortarbejde"], cons: ["Ikke justerbar deklination", "Mere end et begynder-kompas koster"], specs: { type: "baseplade-kompas", brand: "Silva" } },
      { product_id: "backpackerlife-67795", score: 8.0, award_label: "Bedst til prisen", best_for: "Begynder / backup", editorial_note: "Highlander Map er det billige baseplade-kompas der gør jobbet: orienter kortet og tag en kurs på den korte tur. Perfekt som første kompas eller fast backup i rygsækken.", pros: ["Meget lav pris", "Baseplade til kortet", "Let og altid med"], cons: ["Enkel konstruktion", "Ingen ekstra-funktioner"], specs: { type: "baseplade-kompas", brand: "Highlander" } },
      { product_id: "backpackerlife-72820", score: 8.6, award_label: "Bedste premium", best_for: "Justerbar deklination", editorial_note: "Silva Ranger S er kompasset til seriøs navigation: justerbar deklination, spejl til præcis sigte og lysende markører. Det du vælger, hvis du går langt eller i ukendt terræn.", pros: ["Justerbar deklination", "Spejl til præcis pejling", "Lysende markører til mørke"], cons: ["Højeste pris i testen", "Flere funktioner kræver øvelse"], specs: { type: "spejl/sigtekompas", brand: "Silva" } },
      { product_id: "backpackerlife-938770", score: 8.2, award_label: "Bedste spejlkompas (value)", best_for: "Præcis pejling billigt", editorial_note: "SOL Sighting Compass med spejl giver præcis sigte-navigation til en venlig pris — pejl et fjernt punkt og aflæs kursen samtidig. Spejlet dobler som nødsignal.", pros: ["Spejl til præcis sigte", "God pris for spejlkompas", "Spejl kan signalere nød"], cons: ["Mindre kendt brand", "Basis-finish"], specs: { type: "spejlkompas", brand: "SOL" } },
      { product_id: "backpackerlife-209755", score: 8.1, award_label: "Bedste sigtekompas (budget)", best_for: "Pejling på budget", editorial_note: "Highlander Scout Sighting er det billige sigtekompas: kighul til mere præcis pejling end en ren baseplade, til en pris hvor begynderen kan øve sig uden frygt.", pros: ["Sigte til præcis pejling", "Lav pris", "God til at lære teknikken"], cons: ["Enkel konstruktion", "Ikke justerbar deklination"], specs: { type: "sigtekompas", brand: "Highlander" } },
      { product_id: "backpackerlife-209754", score: 7.9, award_label: "Bedste militær-stil", best_for: "Robust lensatic", editorial_note: "Highlander Military er det robuste lensatic-kompas i klassisk militær-stil: kraftig konstruktion og kighul-sigte til den der vil have et solidt, no-nonsense kompas i lommen.", pros: ["Robust militær-konstruktion", "Lensatic kighul-sigte", "Lav pris"], cons: ["Tungere og kompakt aflæsning", "Mindre velegnet til fint kortarbejde"], specs: { type: "lensatic kompas", brand: "Highlander" } },
    ],
  },

  // ───────────────────────── GAMACHER ─────────────────────────
  {
    slug: "gamacher",
    title: "Bedste gamacher 2026",
    category: "gamacher",
    seo_title: "Bedste gamacher 2026 – gaiters til vandring & shelter | ShelterDK",
    seo_description: "Find de bedste gamacher (gaiters) til vandring i vådt og mudret terræn. Vi scorer 4 favoritter — fra budget til Gore-Tex, 199 til 899 kr.",
    intro: "Gamacher (gaiters) er det oversete stykke grej der holder vand, mudder, sne og småsten ude af støvlerne. På våde danske stier og i højt græs er de forskellen mellem tørre og gennemblødte fødder. Vi har scoret de bedste gamacher — fra billige hverdagsmodeller til Gore-Tex til de hårde forhold.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "OutdoorGearLab – best gaiters", url: "https://www.outdoorgearlab.com/topics/clothing-mens/best-gaiters" },
      { title: "Montane – gaiter range", url: "https://www.montane.com/" },
    ],
    faq: [
      { q: "Hvad bruger man gamacher til?", a: "Gamacher lukker hullet mellem støvle og bukseben, så vand, mudder, sne, småsten og grene ikke kommer ned i støvlen. På våde stier, i højt dugvådt græs, i mudret terræn og i sne holder de fødder og underben tørre og rene — og forhindrer den evige irritation af grus i skoen." },
      { q: "Høje eller lave gamacher?", a: "Lave (trail-)gamacher dækker anklen og holder grus og småsten ude — lette og luftige til tørre stier og trailløb. Høje gamacher når op under knæet og beskytter hele underbenet mod vand, mudder og sne — det rigtige til våd vandring, vinter og kraftigt terræn. Til danske shelterture i skuldersæsonen er en høj model mest alsidig." },
      { q: "Har jeg brug for Gore-Tex i gamacher?", a: "En vandtæt, åndbar membran (Gore-Tex) holder underbenet tørt i vedvarende regn og vådt græs uden at koge — det rigtige til seriøs våd vandring. Billigere gamacher i tætvævet nylon afviser vand og holder mudder/grus ude fint til de fleste ture; til den hårde våde dag vinder membranen." },
      { q: "Passer gamacher til alle støvler?", a: "De fleste gamacher har en justerbar krog foran til snørebåndet og en rem under sålen, så de passer et bredt udvalg af vandrestøvler og -sko. Tjek at remmen under sålen er udskiftelig eller robust — det er den del der slides først. Til low-cut sko vælger du en lav trail-gamache." },
      { q: "Hvad gør dyre gamacher bedre?", a: "Billige gamacher (under 250 kr) holder grus og lidt vand ude fint. Mere betaler for: vandtæt membran (Gore-Tex), holdbart ripstop mod gren og krat, bedre lukning og remme der ikke slides over, samt lavere vægt. Til hård, våd og vinterbrug holder de dyre længere og tørrere." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du de rigtige gamacher\n\nGamacher (gaiters) lukker hullet mellem støvle og bukseben — og dermed vejen for alt det, der ellers ender i din støvle: vand, mudder, sne, grus og grene. Det er et billigt, oversete stykke grej der gør en stor forskel på våde danske ture. Tre ting afgør valget: **højde**, **vandtæthed** og **holdbarhed**.\n\n## Høje vs. lave\n\n- **Lave (trail-)gamacher:** dækker anklen, holder grus og småsten ude — lette og luftige til tørre stier, trailløb og low-cut sko.\n- **Høje gamacher:** når op under knæet og beskytter hele underbenet mod vand, mudder og sne — det rigtige til våd vandring, vinter og kraftigt terræn.\n\nTil de fleste danske shelterture i skuldersæsonen er en høj model mest alsidig.\n\n## Vandtæthed\n\nEn **Gore-Tex-membran** holder underbenet tørt i vedvarende regn og vådt græs uden at koge — til seriøs våd vandring. Billigere gamacher i tætvævet nylon **afviser** vand og holder mudder og grus ude fint til de fleste ture. Til den hårde, våde dag vinder membranen; til almindelig brug rækker nylon langt.\n\n## Pasform og holdbarhed\n\nGamacher fæstnes med en krog foran i snørebåndet og en rem under sålen. Remmen under sålen er det første der slides — tjek at den er robust eller udskiftelig. Vælg et holdbart ripstop, hvis du går i krat og gren, og sørg for lukningen sidder fast om læggen.\n\n## Brug dem rigtigt\n\nGamacher kommer udenpå støvlen og bukserne: krog i snørebåndet foran, rem under sålen, og luk tæt om læggen. De dækker hele forgangen til skoen, så vand løber af i stedet for ned i støvlen — par dem med dine [vandrestøvler](/bedste/vandrestovler) for tørre fødder.\n\n## Vores anbefaling\n\nTil de fleste: Black Diamond Frontpoint GTX — vandtæt, holdbar og alsidig til våd vandring og vinter. Skal det bare være billigt mod grus og mudder, gør Highlander Walking jobbet. Vil du spare vægt, er Montane Cetus den lette løsning til hurtige ture.`,
    entries: [
      { product_id: "backpackerlife-816548", score: 8.6, award_label: "Bedst i test", best_for: "Vandtæt alround", editorial_note: "Black Diamond Frontpoint GTX V2 er den alsidige vinder: Gore-Tex-vandtæt, robust og bygget til alt fra våd vandring til sne. Holder underbenet tørt, hvor billigere gamacher giver op.", pros: ["Vandtæt Gore-Tex", "Robust konstruktion", "Alsidig til vådt og vinter"], cons: ["Højere pris", "Tungere end letvægt"], specs: { type: "høj gamache", membran: "Gore-Tex" } },
      { product_id: "backpackerlife-67821", score: 8.0, award_label: "Bedst til prisen", best_for: "Mudder & grus", editorial_note: "Highlander Walking er den billige hverdags-gamache: holder mudder, grus og lidt vand ude til en pris, hvor der ikke er noget at betænke. Fin indgang til at gå med gamacher.", pros: ["Meget lav pris", "Holder grus/mudder ude", "Let at gå med"], cons: ["Ikke membran — kun vandafvisende", "Basis-materiale"], specs: { type: "gamache", membran: "ingen (nylon)" } },
      { product_id: "backpackerlife-812322", score: 8.3, award_label: "Bedste letvægt", best_for: "Hurtige ture", editorial_note: "Montane Cetus er den lette gamache til dig der tæller gram: tilstrækkelig beskyttelse mod vand og grus uden vægten af en tung vintermodel. Til fast-hiking og milde forhold.", pros: ["Let og kompakt", "God beskyttelse pr. gram", "Kvalitetsmærke (Montane)"], cons: ["Mindre robust end Gore-Tex-model", "Ikke til hård vinter"], specs: { type: "letvægt gamache", brand: "Montane" } },
      { product_id: "backpackerlife-812308", score: 8.4, award_label: "Bedste premium", best_for: "Hård & våd brug", editorial_note: "Montane Alta er premium-gamachen til de hårde forhold: kraftig, beskyttende og bygget til vedvarende vådt og kraftigt terræn. Til dig der går meget og under alle forhold.", pros: ["Kraftig beskyttelse", "Holdbar til hård brug", "Montane-kvalitet"], cons: ["Højeste pris", "Overkill til lette sommerture"], specs: { type: "høj gamache", brand: "Montane" } },
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
  console.log("\nFærdig (v6). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
