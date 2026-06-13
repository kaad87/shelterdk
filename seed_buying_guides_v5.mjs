// Seed v5: niche-klynge (frysetørret mad, myggenet, sovepude & lagenpose).
// Samme idempotente mønster som tidligere seeds. Kør: node seed_buying_guides_v5.mjs
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
  // ───────────────────────── FRYSETØRRET MAD ─────────────────────────
  {
    slug: "frysetorret-mad",
    title: "Bedste frysetørrede mad 2026",
    category: "frysetorret",
    seo_title: "Bedste frysetørret mad 2026 – trekking-mad til shelter | ShelterDK",
    seo_description: "Find den bedste frysetørrede mad til shelterture og vandring. Vi scorer 6 favoritter — morgenmad, aftensmad, dessert og snack, fra 19 til 89 kr.",
    intro: "Frysetørret mad er turkostens geni: let som luft, holder i årevis, og bliver til et varmt måltid med kun kogende vand. Vi har scoret de bedste poser til shelterture — fra fyldig aftensmad til morgenmad, dessert og snack.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Trek'N Eat – freeze-dried expedition food", url: "https://www.trekneat.com/" },
      { title: "OutdoorGearLab – best backpacking food", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-backpacking-food" },
    ],
    faq: [
      { q: "Hvordan tilbereder man frysetørret mad?", a: "Hæld kogende vand direkte i posen op til måle-stregen, rør, luk og lad den trække 8-10 minutter — så spiser du af posen uden opvask. Du skal altså kun bruge en lille kedel eller stormkøkken til at koge vand, ikke en gryde. Tjek altid vandmængden på bagsiden; for lidt giver tør, sej mad." },
      { q: "Hvor meget vejer en portion?", a: "En frysetørret hovedret vejer typisk 100-160 g tør og giver 400-800 kcal — mod 400-600 g for tilsvarende dåse- eller frisk mad. Det er hele pointen: du bærer kun den tørre vægt og tilsætter vand fra naturen eller medbragt. På en flerdagstur sparer det kilo i rygsækken." },
      { q: "Hvor længe holder frysetørret mad?", a: "Almindelige trekking-poser har typisk 2-8 års holdbarhed uåbnet — perfekt til at have et par i depotet året rundt. Der findes også beredskabs-versioner med 15-25 års holdbarhed til nødlageret. Opbevar tørt og køligt, og tjek 'bedst før' på posen." },
      { q: "Hvor mange kalorier skal jeg regne med pr. dag?", a: "På en aktiv vandredag forbrænder de fleste 2.500-4.000 kcal. En frysetørret hovedret dækker 400-800 kcal, så regn med en hovedret plus morgenmad, snacks og evt. dessert for at ramme behovet. Tag hellere én pose for meget med — sult i shelteret er noget skidt." },
      { q: "Er frysetørret mad sund og kan veganere/vegetarer spise med?", a: "Udvalget dækker både kød, vegetarisk og veganske retter — kig efter mærkning på posen. Frysetørring bevarer det meste af næringen, men salt­indholdet er ofte højt (det hjælper væskebalancen på tur). Til hverdagsbrug er friskt bedre; til tur er det svært at slå på vægt og holdbarhed." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du den rigtige frysetørrede mad\n\nFrysetørret mad er friluftslivets bedste vægt-tricks: vandet er fjernet, så en hel aftensmad vejer som en pose chips og fylder ingenting. På shelterturen tilsætter du bare kogende vand, venter ti minutter og spiser direkte af posen — ingen gryde, ingen opvask. Tre ting afgør valget: **måltidstype**, **kalorier pr. gram** og **smag**.\n\n## Sådan virker det\n\nDu koger vand på dit [stormkøkken](/bedste/stormkoekken), hælder det i posen op til stregen, rører rundt og lukker. Efter 8-10 minutter har posen suget vandet og er klar. Fordi du spiser af posen, slipper du for opvask — en kæmpe fordel ved shelteret hvor vand er kostbart.\n\n## Måltider hele dagen\n\n- **Morgenmad:** müsli og grød der gør klar til dagens etape.\n- **Aftensmad:** den fyldige hovedret — pasta, ris- og gryderetter med 400-800 kcal.\n- **Dessert:** chokolademousse og lignende — moralen i lejren efter en lang dag.\n- **Snack:** kiks og kraftbarer til undervejs, så blodsukkeret holder.\n\n## Vægt, kalorier og holdbarhed\n\nEn hovedret vejer 100-160 g tør og giver 400-800 kcal — mod en halv kilo for tilsvarende dåsemad. Almindelige poser holder 2-8 år, så du kan have et par liggende i depotet. På en aktiv dag (2.500-4.000 kcal) skal du regne med hovedret + morgenmad + snacks for at ramme behovet.\n\n## Smag og mæthed\n\nSmagen er kommet langt: navnemærker som Trek'N Eat og Adventure Food laver retter, der faktisk smager af noget. Hav hellere én pose for meget med end for lidt — sult er den hurtigste vej til en dårlig tur. Og husk: lidt ekstra salt og en bouillonterning kan løfte selv en kedelig pose.\n\n## Vores anbefaling\n\nTil de fleste: en fyldig hovedret som Pasta Carbonara som basis, suppleret med en let suppe og en dessert. Vil du have det bedste, så prøv Trek'N Eats navneretter. Og pak altid en pose Trekking Kiks som nødration i sidelommen.`,
    entries: [
      { product_id: "backpackerlife-486575", score: 8.7, award_label: "Bedst i test", best_for: "Fyldig aftensmad", editorial_note: "Pasta Carbonara er den klassiske crowd-pleaser: cremet, mættende og smager af noget efter en lang dag. Den sikre hovedret til de fleste — vores alround-favorit til prisen.", pros: ["Mættende og velsmagende", "Lav pris pr. måltid", "Spises direkte af posen"], cons: ["Højt saltindhold", "Ikke vegansk"], specs: { type: "hovedret", maaltid: "aftensmad" } },
      { product_id: "backpackerlife-381757", score: 8.8, award_label: "Bedste premium", best_for: "Smag i topklasse", editorial_note: "Trek'N Eat Chicken Tikka Masala er navneret-kvalitet: krydret, fyldig og blandt det bedstsmagende frysetørrede der findes. Investeringen når smagen betyder ekstra.", pros: ["Fremragende smag", "Solid portion og kalorier", "Anerkendt ekspeditionsmærke"], cons: ["Højere pris", "Stærkere krydring er ikke for alle"], specs: { type: "hovedret", maaltid: "aftensmad" } },
      { product_id: "backpackerlife-661738", score: 8.1, award_label: "Bedst til prisen", best_for: "Let frokost / forret", editorial_note: "Kyllingesuppe er den varme, billige opstrammer midt på dagen eller som forret — let at fordøje og hurtig at lave. Bedst værdi pr. krone i testen.", pros: ["Meget lav pris", "Varmende og let", "Hurtig tilberedning"], cons: ["Få kalorier — ikke et fuldt måltid", "Simpel smag"], specs: { type: "suppe", maaltid: "frokost" } },
      { product_id: "backpackerlife-486578", score: 8.4, award_label: "Bedste dessert", best_for: "Sødt i lejren", editorial_note: "Chokolademousse er moralen efter en hård dag — en sød, luftig dessert der vejer ingenting og løfter humøret i shelteret. Lille luksus, stor effekt.", pros: ["Billig luksus", "Vejer næsten intet", "Højt humør-afkast"], cons: ["Kræver koldt vand for bedst resultat", "Ikke mættende"], specs: { type: "dessert", maaltid: "dessert" } },
      { product_id: "backpackerlife-631524", score: 8.2, award_label: "Bedste snack", best_for: "Energi undervejs", editorial_note: "Trek'N Eat Trekking Kiks er nødrationen der bor permanent i sidelommen: kompakte, holdbare og fulde af energi til når blodsukkeret dykker midt på etapen.", pros: ["Spiseklar — intet vand", "Meget billig", "Lang holdbarhed"], cons: ["Tør — drik vand til", "Kun en mellemmåltid-løsning"], specs: { type: "snack/kiks", maaltid: "snack" } },
      { product_id: "backpackerlife-381755", score: 8.3, award_label: "Bedste morgenmad", best_for: "Start på dagen", editorial_note: "Trek'N Eat Fuldkorns Müsli med frugt er morgenmaden der gør klar til etapen: fuldkorn og frugt, klar med vand på minutter. Bedre brændstof end en energibar.", pros: ["Fyldig fuldkorns-morgenmad", "God smag med frugt", "Hurtig om morgenen"], cons: ["Bedst med koldt vand/mælk", "Lidt dyrere end snacks"], specs: { type: "morgenmad", maaltid: "morgenmad" } },
    ],
  },

  // ───────────────────────── MYGGENET ─────────────────────────
  {
    slug: "myggenet",
    title: "Bedste myggenet 2026",
    category: "myggenet",
    seo_title: "Bedste myggenet 2026 – hovednet & sovenet til shelter | ShelterDK",
    seo_description: "Find det bedste myggenet til shelterture og hængekøje. Vi scorer 6 favoritter — hovednet, finmasket net og sovenet, fra 39 til 339 kr.",
    intro: "Myg og knot kan ødelægge den fineste sheltertur — især ved vand og i skumringen. Vi har scoret de bedste myggenet: lette hovednet til at gå med, og sovenet der lukker insekterne ude af det åbne shelter og hængekøjen.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Lifesystems – insect protection guide", url: "https://www.lifesystems.co.uk/" },
      { title: "Statens Serum Institut – myg og insektbid", url: "https://www.ssi.dk/" },
    ],
    faq: [
      { q: "Hovednet eller sovenet — hvad skal jeg vælge?", a: "Et hovednet bæres over hat/kasket og beskytter ansigt og hals, mens du går eller laver mad — let, billigt og altid med i rygsækken. Et sovenet (myggenet til shelter eller hængekøje) hænges op og giver et insektfrit rum at sove i. Til en sommertur ved vand er begge værd at have: hovednet om dagen, sovenet om natten." },
      { q: "Hvad betyder maskestørrelse, og hvorfor er 'no-see-um' vigtigt?", a: "Maskestørrelsen afgør hvad nettet holder ude. Almindelige net stopper myg, men knot (de små 'no-see-ums') er små nok til at smutte igennem. Vil du være sikker ved vand og i klitter, så vælg et finmasket 'no-see-um'-net — det stopper både myg og knot, men er en anelse varmere at bære." },
      { q: "Skal myggenettet være imprægneret?", a: "Imprægnerede net er behandlet med insektmiddel (typisk permethrin), så insekter der lander på nettet, dør eller jages væk i stedet for bare at vente. Det giver ekstra beskyttelse i myg-tunge områder, men effekten aftager over tid og ved vask. Til Danmark er et godt ubehandlet finmasket net rigeligt for de fleste." },
      { q: "Virker et myggenet til hængekøje?", a: "Ja — der findes dedikerede hængekøje-net der omslutter hele køjen, og generelle sovenet du selv hænger op. Til hængekøjeovernatning er et net næsten et must om sommeren, da din ryg ellers er udsat nedefra. Tjek at nettet er stort nok til din specifikke køje." },
      { q: "Hvad gør jeg ud over net mod myg?", a: "Net er førstevalget, fordi det virker uden kemi. Suppler med myggebalsam (DEET eller icaridin) på bar hud, dæk arme og ben til i skumringen, og slå lejr lidt væk fra stillestående vand hvor myggen yngler. Et hovednet plus balsam dækker stort set alt." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## Sådan vælger du det rigtige myggenet\n\nVed danske søer, åer og moser kan myg og knot gøre en ellers perfekt sommeraften ulidelig. Myggenet er den simple, kemifri løsning: et fysisk lag mellem dig og insekterne. Der er to hovedtyper — **hovednet** til at gå med, og **sovenet** til shelteret og hængekøjen — og det vigtigste tekniske valg er **maskestørrelsen**.\n\n## Hovednet vs. sovenet\n\nEt **hovednet** bæres over en hat eller kasket (så stoffet holdes væk fra ansigtet) og beskytter dig mens du går, fisker eller laver mad. Det vejer næsten intet og bør altid være i rygsækken om sommeren. Et **sovenet** hænges op over sovepladsen og giver et insektfrit rum — uundværligt i det åbne shelter og hængekøjen, hvor du ellers ligger frit fremme.\n\n## Maskestørrelse: pas på knot\n\nDet vigtigste valg er hvor fint nettet er. Almindelige net stopper myg, men **knot (no-see-ums)** er så små at de smutter gennem grovere net. Sover du ved vand eller i klitter, så vælg et **finmasket no-see-um-net** — det stopper alt, mod at være en smule varmere. Sea to Summit og Lifesystems' fine net er kendt for at lukke selv knot ude.\n\n## Imprægneret eller ej\n\nImprægnerede net (behandlet med permethrin) jager insekter væk i stedet for bare at holde dem ude — en fordel i myg-tunge områder. Men effekten aftager med tid og vask, og til dansk brug er et godt ubehandlet net rigeligt for de fleste.\n\n## Brug det rigtigt\n\nBær altid hovednet over en kasket, så stoffet ikke rører huden (myg stikker gennem net der ligger fladt mod kinden). Suppler med myggebalsam på bar hud, og slå lejr lidt væk fra stillestående vand. Nettet plus balsam dækker stort set alle situationer.\n\n## Vores anbefaling\n\nTil de fleste: et finmasket Lifesystems-hovednet i rygsækken hele sommeren. Sover du ofte ude ved vand, så tilføj et Lifesystems MicroNet sovenet til shelteret. Skal det bare være billigt og med, gør Treklifes hovednet jobbet fint.`,
    entries: [
      { product_id: "backpackerlife-363844", score: 8.7, award_label: "Bedst i test", best_for: "Alround hovednet", editorial_note: "Lifesystems' hovednet rammer balancen: finmasket nok til at holde myg ude, let nok til altid at have med, og fra et mærke der ved hvad de laver. Vores alround-vinder.", pros: ["Finmasket og effektivt", "Let — fylder intet", "Pålideligt mærke"], cons: ["Ikke imprægneret", "Bedst over en kasket"], specs: { type: "hovednet", maske: "finmasket" } },
      { product_id: "backpackerlife-104860", score: 8.6, award_label: "Bedste finmaskede", best_for: "Knot ved vand", editorial_note: "Sea to Summit Ultra-Fine Mesh er det net der stopper selv knot — den ekstra-fine maske du vil have, når du slår lejr lige ved søen eller i klitterne.", pros: ["Ultra-fin maske — stopper knot", "Høj kvalitet", "Kompakt"], cons: ["Lidt varmere at bære", "Højere pris end basis-net"], specs: { type: "hovednet", maske: "ultra-finmasket" } },
      { product_id: "backpackerlife-188255", score: 8.1, award_label: "Bedst til prisen", best_for: "Budget / altid med", editorial_note: "Treklife hovednet er den billige forsikring der bor i sidelommen: gør jobbet mod myg til en pris hvor der ikke er noget at tænke over. Køb to.", pros: ["Meget lav pris", "Vejer ingenting", "Gør jobbet mod myg"], cons: ["Grovere maske — knot kan smutte", "Enkel finish"], specs: { type: "hovednet", maske: "standard" } },
      { product_id: "backpackerlife-77766", score: 7.9, award_label: "Bedste basis", best_for: "Onesize backup", editorial_note: "Trespass onesize-hovednet er det enkle backup-net: passer alle, koster lidt og er fin at have i fællesgrejet, så ingen i selskabet står uden.", pros: ["Onesize — passer alle", "Lav pris", "God som ekstra-net"], cons: ["Standard maske", "Basal kvalitet"], specs: { type: "hovednet", maske: "standard" } },
      { product_id: "backpackerlife-149826", score: 8.5, award_label: "Bedste sovenet", best_for: "Insektfrit shelter", editorial_note: "Lifesystems MicroNet Single er sovenettet til det åbne shelter: hæng det op, og du har et insektfrit rum at sove i. Forskellen mellem en hvilende og en plaget nat ved vand.", pros: ["Insektfrit soverum", "Finmasket MicroNet", "Til én person"], cons: ["Kræver ophæng", "Højere pris og vægt"], specs: { type: "sovenet", maske: "finmasket" } },
      { product_id: "backpackerlife-289042", score: 8.3, award_label: "Bedste imprægnerede", best_for: "Myg-tunge områder", editorial_note: "Pharmavoyage Trek 1 er det imprægnerede sovenet til de værste myg-områder: behandlingen jager insekterne væk, ikke bare holder dem ude. Til én person.", pros: ["Imprægneret — jager myg væk", "Til shelter/seng", "Ekstra beskyttelse"], cons: ["Effekt aftager med vask", "Dyrest i testen"], specs: { type: "sovenet imprægneret", maske: "finmasket" } },
    ],
  },

  // ───────────────────── SOVEPUDE & LAGENPOSE ─────────────────────
  {
    slug: "sovepude",
    title: "Bedste sovepude & lagenpose 2026",
    category: "soveudstyr",
    seo_title: "Bedste sovepude & lagenpose 2026 – sovekomfort til shelter | ShelterDK",
    seo_description: "Find den bedste rejsepude og lagenpose til shelterture. Vi scorer 5 favoritter — oppustelig og kompressibel pude samt lagenpose, fra 69 til 199 kr.",
    intro: "De to billigste opgraderinger til en god nats søvn i shelteret er en ordentlig pude og en lagenpose. Vi har scoret de bedste sovepuder — oppustelige og kompressible — og lagenposer der holder soveposen ren og giver et par graders ekstra varme.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Klymit – camp pillow guide", url: "https://www.klymit.com/" },
      { title: "OutdoorGearLab – best camping pillows", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-camping-pillow" },
    ],
    faq: [
      { q: "Oppustelig eller kompressibel sovepude?", a: "En oppustelig pude pakker ned til ingenting og vejer mindst — perfekt når hver gram tæller — men føles fastere og kan glide på liggeunderlaget. En kompressibel pude (skum/fyld) er blødere og mere 'pude-agtig', men fylder mere i rygsækken. Til ultralet vandring vinder oppustelig; til komfort i shelteret vinder kompressibel." },
      { q: "Kan jeg ikke bare bruge tøj som pude?", a: "Jo, en stuepose med fleece eller dunjakke er den klassiske gratis-pude og fungerer fint i nødstilfælde. Men en rigtig sovepude giver markant bedre nakke­støtte og glider ikke væk om natten — for 69-199 kr og næsten ingen vægt er det en af de bedste søvn-investeringer på turen." },
      { q: "Hvad er en lagenpose, og hvorfor bruge den?", a: "En lagenpose (sovepose-liner) er en tynd indersæk du lægger i soveposen. Den holder soveposen ren indvendigt — du vasker det tynde liner i stedet for hele posen — og giver typisk 3-8 graders ekstra varme. Om sommeren kan du sove i lagenposen alene, når soveposen er for varm." },
      { q: "Mummy- eller rektangulær lagenpose?", a: "En mummy-formet (tilspidset) lagenpose passer til mummy-soveposer og vejer mindst — den følger kroppen og fylder lidt. En rektangulær (envelope) lagenpose er mere rummelig at ligge i og fleksibel, men vejer lidt mere. Vælg samme form som din sovepose for bedst pasform." },
      { q: "Hvor meget ekstra varme giver en lagenpose?", a: "Det afhænger af materialet: et tyndt bomulds- eller silke-liner giver typisk 2-5 grader, mens fleece- eller termo-linere kan give 5-8 grader. Det er en billig måde at strække soveposens sæson på — et liner kan løfte en 3-sæsons pose ind i de kølige forårs- og efterårsnætter." },
      DISCLOSURE_FAQ,
    ],
    body_md: `## To billige opgraderinger til bedre søvn\n\nNår [soveposen](/bedste/sovepose) og [liggeunderlaget](/bedste/liggeunderlag) er på plads, er det to små ting der adskiller en god nats søvn i shelteret fra en dårlig: en ordentlig **sovepude** og en **lagenpose**. Begge vejer næsten intet, koster lidt, og gør en mærkbar forskel — derfor er de blandt de mest oversete stykker sovegrej.\n\n## Sovepude: oppustelig vs. kompressibel\n\n- **Oppustelig pude:** pakker ned til lommestørrelse og vejer mindst — du puster den op på sekunder. Føles fastere og kan glide på et glat liggeunderlag, men er det rigtige valg når vægt og pakmål tæller. Klymits X Pillow er klassikeren.\n- **Kompressibel pude (skum/fyld):** blødere og mere 'rigtig pude'-agtig, holder bedre på plads, men fylder mere i rygsækken. Bedst til bilcamping og shelterture hvor komfort slår gram.\n\nKan du ikke bestemme dig, så husk: en sovepude koster 69-199 kr og er en af de bedste søvn-investeringer pr. krone på hele turen.\n\n## Lagenpose: ren sovepose + ekstra varme\n\nEn **lagenpose** (sovepose-liner) er en tynd indersæk med to opgaver: den holder soveposen ren indvendigt (du vasker det tynde liner, ikke hele posen), og den giver typisk **3-8 graders ekstra varme**. Det betyder at en 3-sæsons sovepose pludselig dækker de kølige forårs- og efterårsnætter. Om sommeren kan du sove i lagenposen alene.\n\n## Mummy eller rektangulær?\n\nVælg samme form som din sovepose: **mummy** (tilspidset) til mummy-poser — letvægt og kropsnær — eller **rektangulær/envelope** til mere plads at vende dig i. Pasformen afgør hvor godt liner og pose arbejder sammen.\n\n## Vores anbefaling\n\nTil de fleste: en kompressibel Mikropude til komfort plus en letvægts mummy-lagenpose til ren pose og ekstra varme. Tæller hver gram, så vælg Klymit X Pillow oppustelig. Sammen vejer de under 400 g og koster mindre end et par vandresokker pr. nats bedre søvn.`,
    entries: [
      { product_id: "backpackerlife-1711", score: 8.6, award_label: "Bedst i test", best_for: "Alround komfort", editorial_note: "Highlander Mikropude er den kompressible sweet-spot: blød, pude-agtig komfort til en pris hvor der ikke er noget at betænke. Vores alround-favorit til shelteret.", pros: ["Blød, ægte pude-følelse", "Meget lav pris", "Holder sig på plads"], cons: ["Fylder mere end oppustelig", "Tungere end luftpude"], specs: { type: "sovepude", konstruktion: "kompressibel" } },
      { product_id: "backpackerlife-58700", score: 8.5, award_label: "Bedste oppustelige", best_for: "Letvægt / lille pakmål", editorial_note: "Klymit X Pillow er den oppustelige klassiker: pakker ned til lommestørrelse, vejer næsten intet, og X-formen holder hovedet centreret. Til dig der tæller gram.", pros: ["Pakker mikroskopisk", "Meget let", "X-form holder hovedet på plads"], cons: ["Fastere end skumpude", "Kan glide på glat underlag"], specs: { type: "sovepude", konstruktion: "oppustelig" } },
      { product_id: "backpackerlife-284277", score: 8.3, award_label: "Bedste store pude", best_for: "Maksimal komfort", editorial_note: "Mikropude L er den større udgave til dig der vil have rigtig pude-luksus i shelteret — mere flade og fyld for hovedet, når komfort slår pakmål.", pros: ["Stor, behagelig flade", "Blød kompressibel fyld", "God nakkestøtte"], cons: ["Fylder mest i rygsækken", "Overkill til ultralet"], specs: { type: "sovepude", konstruktion: "kompressibel" } },
      { product_id: "backpackerlife-45893", score: 8.5, award_label: "Bedste lagenpose", best_for: "Letvægt + ekstra varme", editorial_note: "Den letvægts mummy-lagenpose er den oversete varme-bonus: holder soveposen ren og lægger et par grader til, uden at fylde eller veje nævneværdigt. Vores liner-favorit.", pros: ["Letvægt mummy-form", "Holder soveposen ren", "Et par graders ekstra varme"], cons: ["Tilspidset — mindre plads", "Tyndt stof"], specs: { type: "lagenpose", form: "mummy" } },
      { product_id: "backpackerlife-45897", score: 8.2, award_label: "Bedste rummelige", best_for: "Plads til at vende sig", editorial_note: "Envelope-lagenposen er den rektangulære, rummelige liner til dig der ikke kan lide at ligge snøret inde — mere plads at vende dig i, samme rene-pose-fordel.", pros: ["Rummelig rektangulær form", "Plads til at vende sig", "Holder soveposen ren"], cons: ["Vejer lidt mere end mummy", "Mindre kropsnær varme"], specs: { type: "lagenpose", form: "rektangulær" } },
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
  console.log("\nFærdig (v5). Live pris/lager hentes ved render; udsolgte demoteres.");
})();
