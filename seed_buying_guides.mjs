// Seed buyer-intent købsguider på shelterdk.
// Idempotent: upsert på slug (guider) og guide_id+affiliate_product_id (entries).
// Live pris/lager hentes ved render — her sætter vi kun redaktionelt indhold + specs.
// Kør: node seed_buying_guides.mjs
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
if (!URL || !KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

const TODAY = new Date().toISOString();

const guides = [
  {
    slug: "sovepose",
    title: "Bedste sovepose 2026",
    category: "sovepose",
    seo_title: "Bedste sovepose 2026 – test og købsguide | ShelterDK",
    seo_description:
      "Find den bedste sovepose til shelter og friluftsliv. Vi sammenligner dun vs. syntetisk, temperatur og vægt — fra budget til premium.",
    intro:
      "En god sovepose er forskellen mellem en kold, søvnløs nat og en tur du husker med glæde. Her er vores bud på de bedste soveposer til shelter- og friluftsovernatning i Danmark — fra et solidt budgetvalg til poser der holder dig varm langt under frysepunktet.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Sleeping bag temperature ratings (EN/ISO 23537) – forklaring", url: "https://en.wikipedia.org/wiki/EN_13537" },
      { title: "Outdoorsider: dun vs. syntetisk isolering", url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-sleeping-bag" },
    ],
    faq: [
      { q: "Dun eller syntetisk sovepose?", a: "Dun pakker mindst, vejer mindst og holder længst — men taber isolering hvis den bliver våd og koster mere. Syntetisk isolerer stadig når den er fugtig, tørrer hurtigt og er billigere, men fylder og vejer mere. Til fugtigt dansk klima og begyndere er syntetisk et trygt valg; til lange ture hvor vægt og pakmål tæller, vinder dun." },
      { q: "Hvor varm skal en sovepose være til shelter i Danmark?", a: "Til forår/efterår i et åbent shelter anbefaler vi en komforttemperatur på 0 til -5 °C, så du har margin på de kolde nætter. Om sommeren rækker en pose med komfort omkring 8-10 °C. Husk at temperatur-tal er vejledende — sov med tøj og hue hvis du fryser let." },
      { q: "Hvad betyder komforttemperatur kontra grænsetemperatur?", a: "Komforttemperatur er den laveste temperatur hvor en gennemsnitlig person sover komfortabelt. Grænsetemperatur (limit) er hvor man lige kan sove sammenrullet uden at fryse. Vælg ud fra komforttemperaturen — ikke den mere optimistiske grænse." },
      { q: "Skal jeg bruge liggeunderlag under soveposen?", a: "Ja. Det meste kuldetab sker nedad mod jorden, og selv den bedste sovepose isolerer dårligt når dunet mases sammen under dig. Et liggeunderlag med en passende R-værdi er lige så vigtigt som selve posen." },
      { q: "Hvordan opbevarer jeg soveposen, så den holder?", a: "Opbevar den løst — i en stor opbevaringspose eller hængende — ikke sammenpresset i kompressionsposen. Konstant kompression ødelægger isoleringsevnen over tid, især på dun." },
    ],
    body_md: `## Sådan vælger du den rigtige sovepose

Tre ting afgør valget: **temperatur**, **isolering** og **vægt/pakmål**. Begynd med temperaturen — hvornår på året sover du ude? Til shelterture i det meste af året i Danmark er en 3-sæsons pose med komfort omkring 0 °C det mest alsidige valg.

## Dun eller syntetisk

**Dun** giver mest varme for vægten og pakker mindst, men er dyrere og mister isolering hvis den bliver våd. **Syntetisk** isolerer stadig når den er fugtig, tørrer hurtigt og koster mindre — til gengæld fylder og vejer den mere. I et fugtigt dansk klima er syntetisk et trygt og billigt udgangspunkt, mens dun belønner dig på de lange, vægtbevidste ture.

## Form og pasform

En **mumie-model** slutter tæt om kroppen og isolerer bedst, mens en rektangulær pose giver mere plads at vende sig i. Vælg den rigtige længde — for meget tomt rum i posen er koldluft du selv skal varme op.

## Vores anbefaling

Til de fleste er en 3-sæsons mumiepose med komfort omkring 0 °C det rigtige. Skal du sove ude om vinteren, så gå efter en pose i −10 °C-klassen og kombinér med et godt liggeunderlag.`,
    entries: [
      {
        product_id: "outmore-7045953013038",
        award_label: "Bedst i test",
        editorial_note:
          "En alsidig 3-sæsons dunpose der rammer det meste af det danske år. Lav vægt, godt pakmål og pålidelig varme omkring frysepunktet — det vi anbefaler de fleste at starte med.",
        pros: ["Alsidig 3-sæsons varme", "Let og pakker småt (dun)", "Solid kvalitet fra Helsport"],
        cons: ["Dyrere end syntetiske poser", "Skal holdes tør"],
        specs: { komfort_temp: 0, fyld: "dun", form: "mumie" },
      },
      {
        product_id: "outmore-9327868990849",
        award_label: "Bedste letvægt",
        editorial_note:
          "Når hvert gram og hver liter i rygsækken tæller: 900+ fill power dun giver maksimal varme for vægten. Til den vægtbevidste vandrer.",
        pros: ["Ekstremt let og kompakt", "Høj fill power (900+)", "Premium dunkvalitet"],
        cons: ["Høj pris", "Kræver omhyggelig tør opbevaring"],
        specs: { fyld: "dun (900+)", form: "mumie" },
      },
      {
        product_id: "outmore-7045953012949",
        award_label: "Bedste til vinter",
        editorial_note:
          "Til kolde nætter og vinterture: en kraftig dunpose i −10 °C-klassen der holder dig varm når temperaturen falder. Kombinér med et liggeunderlag med høj R-værdi.",
        pros: ["Varm helt ned i minusgrader", "Robust dunisolering", "God til vinter-shelter"],
        cons: ["For varm til sommerbrug", "Vejer og fylder mere"],
        specs: { komfort_temp: -10, fyld: "dun", form: "mumie" },
      },
      {
        product_id: "backpackerlife-284278",
        award_label: "Bedste budget",
        editorial_note:
          "Skal du bare i gang uden at bruge en formue? En enkel 3-sæsons syntetpose der gør arbejdet på milde til kølige nætter — perfekt til den første sheltertur.",
        pros: ["Meget lav pris", "Syntetisk — tåler fugt", "Fint udgangspunkt for begyndere"],
        cons: ["Fylder mere i pakningen", "Ikke til rigtig kolde nætter"],
        specs: { fyld: "syntetisk", form: "mumie" },
      },
      {
        product_id: "outmore-5709388147172",
        award_label: "Bedste til sommer",
        editorial_note:
          "Let og billig sommerpose til de lune nætter. Når du ikke behøver tung isolering, er den nem at have med og fylder lidt.",
        pros: ["Billig og let", "Ideel til sommer", "Syntetisk og pasningsfri"],
        cons: ["Kun til milde nætter", "Begrænset til varmt vejr"],
        specs: { komfort_temp: 8, fyld: "syntetisk", form: "mumie" },
      },
    ],
  },

  {
    slug: "liggeunderlag",
    title: "Bedste liggeunderlag 2026",
    category: "liggeunderlag",
    seo_title: "Bedste liggeunderlag 2026 – test og købsguide | ShelterDK",
    seo_description:
      "Find det bedste liggeunderlag til shelter og telt. Vi forklarer R-værdi, komfort og vægt — fra billigt skum til oppustelige premium-mads.",
    intro:
      "Liggeunderlaget er det mest oversete stykke sovegrej — og det vigtigste for varmen. Det meste kuldetab sker nedad mod jorden, så et godt underlag holder dig varmere end en dyrere sovepose ville. Her er vores favoritter fra simpelt skum til luksuriøse oppustelige mads.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Hvad er R-værdi på liggeunderlag? (ASTM F3340)", url: "https://en.wikipedia.org/wiki/Sleeping_pad" },
    ],
    faq: [
      { q: "Hvad er R-værdi?", a: "R-værdi måler hvor godt underlaget isolerer mod kulde fra jorden. Jo højere tal, jo varmere. Til sommer rækker R 1-2, til 3-sæsons brug vil du have R 3-4, og til vinter R 5 eller mere." },
      { q: "Oppusteligt, selvoppustende eller skum?", a: "Oppustelige mads er mest komfortable og pakker småt, men kan punktere. Selvoppustende er en robust mellemvej. Skum er billigst, kan ikke punktere og fungerer som backup — men er mindre komfortabelt og fylder." },
      { q: "Hvilket liggeunderlag til shelter?", a: "Til shelter med trægulv er et selvoppustende eller oppusteligt underlag med R-værdi omkring 3-4 et godt alround-valg. Sover du direkte på kold jord eller om vinteren, så vælg højere R-værdi." },
      { q: "Kan jeg kombinere to underlag?", a: "Ja — et tyndt skumunderlag under et oppusteligt giver både ekstra isolering (R-værdierne lægges sammen) og beskytter mod punktering. En klassisk vinterløsning." },
    ],
    body_md: `## Det vigtigste tal: R-værdi

R-værdien fortæller hvor godt underlaget isolerer mod kulde fra jorden. Sigt efter **R 3-4 til 3-sæsons** brug og **R 5+ til vinter**. Et tyndt skumunderlag under et oppusteligt øger samlet R-værdi og beskytter mod punktering.

## Typer af underlag

**Oppustelige** mads er mest komfortable og pakker mindst — men kan punktere, så tag en lap med. **Selvoppustende** er en robust og bekvem mellemvej. **Skum** er billigst og uopslideligt, men mindre komfortabelt og fylder mere.

## Komfort og vægt

Tykkelse betyder komfort — 5 cm eller mere føles markant bedre end et tyndt underlag, især hvis du sover på siden. Vægtbevidste vandrere går efter oppustelige mads, mens campere og shelterfolk ofte prioriterer komfort over gram.`,
    entries: [
      {
        product_id: "outmore-9327868139736",
        award_label: "Bedst i test",
        editorial_note:
          "Tykt, behageligt og selvoppustende — det føles næsten som en madras. Til shelter- og camping hvor komfort vejer tungere end gram er det svært at slå.",
        pros: ["Meget komfortabel", "Selvoppustende — nemt", "Robust til shelter og camping"],
        cons: ["Fylder en del", "Tungere end ultralette mads"],
        specs: { type: "selvoppustende" },
      },
      {
        product_id: "outmore-7045952913674",
        award_label: "Bedste til vinter",
        editorial_note:
          "Høj isolering (R5+) til de kolde nætter, hvor kulden fra jorden ellers stjæler varmen. Et oplagt valg til vinter-shelter.",
        pros: ["Høj R-værdi til vinter", "Solid Helsport-kvalitet", "Holder varmen mod kold jord"],
        cons: ["Overkill om sommeren", "Højere pris"],
        specs: { r_vaerdi: 5, type: "oppustelig" },
      },
      {
        product_id: "outmore-0841487144173",
        award_label: "Bedste letvægt",
        editorial_note:
          "Isoleret og oppusteligt med lav vægt og godt pakmål — til vandreren der vil have varme uden at slæbe rundt på det.",
        pros: ["Let og kompakt", "Isoleret til 3-sæsons", "God komfort for vægten"],
        cons: ["Kan punktere — tag lap med", "Lidt støjende materiale"],
        specs: { type: "oppustelig", r_vaerdi: 4 },
      },
      {
        product_id: "outmore-5709388082527",
        award_label: "Bedste budget",
        editorial_note:
          "Et solidt selvoppustende underlag til en lav pris fra Robens. Perfekt udgangspunkt der dækker det meste af friluftsåret.",
        pros: ["Lav pris", "Selvoppustende komfort", "Pålideligt mærke"],
        cons: ["Fylder mere end premium", "Moderat isolering"],
        specs: { type: "selvoppustende" },
      },
      {
        product_id: "outmore-5709388148018",
        award_label: "Bedste backup/skum",
        editorial_note:
          "Billigt foldbart skumunderlag der aldrig punkterer. Glimrende som backup, ekstra isolering om vinteren eller til den hårdføre minimalist.",
        pros: ["Kan ikke punktere", "Meget billig", "God som ekstra vinterisolering"],
        cons: ["Mindst komfort", "Fylder udvendigt på rygsækken"],
        specs: { type: "skum" },
      },
    ],
  },

  {
    slug: "pandelampe",
    title: "Bedste pandelampe 2026",
    category: "pandelampe",
    seo_title: "Bedste pandelampe 2026 – test og købsguide | ShelterDK",
    seo_description:
      "Find den bedste pandelampe til friluftsliv. Vi sammenligner lysstyrke, batteritid og genopladelighed — fra budget til premium.",
    intro:
      "En pålidelig pandelampe er uundværlig på enhver sheltertur — til madlavning efter mørkets frembrud, natlige toiletbesøg og tidlige morgener. Her er vores favoritter med fokus på lysstyrke, batteritid og brugervenlighed.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "ANSI/PLATO FL1 – standard for lommelygters lysstyrke og rækkevidde", url: "https://en.wikipedia.org/wiki/Flashlight#Performance_standards" },
    ],
    faq: [
      { q: "Hvor mange lumen skal en pandelampe have?", a: "Til lejrbrug og gang rækker 200-400 lumen rigeligt. Vil du belyse stier i fart (løb, MTB) eller se langt, så gå efter 800 lumen og opefter. Flere lumen betyder også kortere batteritid på højeste trin." },
      { q: "Genopladelig eller batterier?", a: "Genopladelige (USB) er billigst i drift og bedst i hverdagen. Almindelige batterier er en fordel på lange ture uden strøm, hvor du kan skifte i felten. Nogle lamper kan begge dele — det er det mest fleksible." },
      { q: "Hvad er rødt lys godt for?", a: "Rødt lys bevarer dit nattesyn og blænder ikke dine telt- eller shelterkammerater. Brug det til at læse, finde ting og bevæge dig i lejren uden at ødelægge mørkesynet." },
      { q: "Holder pandelamper til regn?", a: "De fleste friluftspandelamper har en IP-klassificering der tåler regn og stænk. Tjek for mindst IPX4 hvis du færdes i dansk vejr — undgå at nedsænke dem medmindre de er specifikt vandtætte." },
    ],
    body_md: `## Lysstyrke og rækkevidde

**Lumen** måler den samlede lysmængde, mens rækkevidde fortæller hvor langt lyset når. Til lejr og gang rækker 200-400 lumen; til løb og hurtig færden i mørke vil du have 800+ lumen. Husk at højeste lysstyrke dræner batteriet hurtigt.

## Batteri og genopladning

Genopladelige (USB) lamper er billigst og nemmest i hverdagen. Til lange ture uden strøm er udskiftelige batterier en fordel — og de mest fleksible lamper kan begge dele. Tjek batteritiden på et **realistisk** lystrin, ikke kun på det laveste.

## Komfort og features

Et godt hovedbånd, lav vægt og en **rødlys-tilstand** (bevarer nattesynet) gør stor forskel i praksis. Til dansk vejr bør lampen tåle regn — kig efter mindst IPX4.`,
    entries: [
      {
        product_id: "outmore-7318860205088",
        award_label: "Bedst i test",
        editorial_note:
          "En alsidig, genopladelig pandelampe med rigelig lysstyrke til både lejr og sti. Det rigtige valg for de fleste friluftsfolk.",
        pros: ["Alsidig lysstyrke (2000 lm)", "Genopladelig via USB", "Pålideligt Silva-kvalitet"],
        cons: ["Mellemklasse-pris", "Højeste trin dræner batteriet"],
        specs: { lumen: 2000, genopladelig: true },
      },
      {
        product_id: "outmore-3342540828926",
        award_label: "Bedste premium",
        editorial_note:
          "Petzls kraftige toptmodel til dem der vil have masser af lys og robusthed. Til krævende ture hvor lyset skal kunne det hele.",
        pros: ["Meget kraftigt lys", "Robust og vejrbestandig", "Topkvalitet fra Petzl"],
        cons: ["Høj pris", "Tungere end simple lamper"],
        specs: { genopladelig: true },
      },
      {
        product_id: "outmore-7318860202742",
        award_label: "Bedste budget",
        editorial_note:
          "Billigste vej til pålidelig Silva-belysning. Mere end nok lys til lejr og gang, uden dikkedarer.",
        pros: ["Lav pris", "Fint til lejr og gang", "Let og enkel"],
        cons: ["Lavere lysstyrke", "Færre funktioner"],
        specs: { genopladelig: true },
      },
      {
        product_id: "outmore-4058205021050",
        award_label: "Bedste til arbejde",
        editorial_note:
          "Robust arbejds-/friluftslampe fra Ledlenser med godt, jævnt lys og solid bygning. Til dig der bruger lampen hårdt.",
        pros: ["Robust bygning", "Jævnt, behageligt lys", "Genopladelig"],
        cons: ["Lidt tungere", "Mere arbejds- end sportsfokus"],
        specs: { genopladelig: true },
      },
      {
        product_id: "outmore-6942870308173",
        award_label: "Bedste alternativ",
        editorial_note:
          "Fenix HP30R leverer kraftigt lys og lang rækkevidde med eksternt batteri — godt til lange, mørke ture.",
        pros: ["Kraftigt lys og rækkevidde", "Langt batteri (ekstern pakke)", "Solid Fenix-kvalitet"],
        cons: ["Eksternt batteri at holde styr på", "Højere pris"],
        specs: { genopladelig: true },
      },
    ],
  },

  {
    slug: "telt",
    title: "Bedste telt 2026",
    category: "telt",
    seo_title: "Bedste telt 2026 – test og købsguide | ShelterDK",
    seo_description:
      "Find det bedste telt til friluftsliv i Norden. Vi gennemgår robuste familie- og ekspeditionstelte, lavvo og et budgetvalg.",
    intro:
      "Et godt telt giver tryghed når vejret slår om. Vores udvalg fokuserer på robuste telte der passer til nordisk friluftsliv — fra rummelige familietelte og hardføre ekspeditionstelte til klassisk lavvo og et budgetvalg til den første tur.",
    last_reviewed_at: TODAY,
    sources: [
      { title: "Teltsæsoner og opbygning – forklaret", url: "https://en.wikipedia.org/wiki/Tent" },
    ],
    faq: [
      { q: "Hvor mange sæsoner skal teltet kunne?", a: "3-sæsons telte dækker forår, sommer og efterår og er nok for de fleste. 4-sæsons (vinter) telte tåler sne og kraftig vind, men er tungere og dyrere. Vælg ud fra hvornår og hvor du faktisk camperer." },
      { q: "Hvor mange personer skal teltet rumme?", a: "Personangivelsen er ofte stram — et '2-personers' telt er hyggeligt for to uden meget grej. Vil du have plads til udstyr eller bevægelsesfrihed, så vælg ét persontal op." },
      { q: "Hvad er en lavvo?", a: "En lavvo (tipi-telt) er et højt, kegleformet telt uden bund, ofte med plads til brændeovn. Det giver masser af ståhøjde og fællesskab og er populært til længere ophold og koldt vejr — men pakker større end et kuppeltelt." },
      { q: "Skal jeg bruge en footprint (teltunderlag)?", a: "En footprint beskytter bunden mod slid og fugt og forlænger teltets levetid. Det er en billig forsikring, især hvis du ofte slår lejr på ujævnt eller stenet underlag." },
    ],
    body_md: `## Vælg teltet efter brugen

Skal det med på vandretur, eller står det på en fast lejrplads? **Vægt og pakmål** afgør om teltet egner sig til at bære, mens **plads og ståhøjde** betyder mest når du bliver længe på samme sted.

## Sæson og robusthed

**3-sæsons** telte dækker det meste af året i Danmark. Skal teltet stå imod sne og kraftig nordisk vind, så kig efter et **4-sæsons** ekspeditionstelt med flere stænger og kraftigere dug — det vejer og koster mere, men giver tryghed i hårdt vejr.

## Lavvo til længere ophold

En **lavvo** (tipi-telt) giver ståhøjde, god ventilation og mulighed for brændeovn. Det er et stærkt valg til basecamp og koldt vejr, hvor komfort og fællesskab vejer tungere end vægt.

## Husk footprint

En footprint beskytter bunden mod slid og fugt og forlænger teltets levetid — en billig forsikring på stenet eller fugtigt underlag.`,
    entries: [
      {
        product_id: "outmore-7029981040778",
        award_label: "Bedst i test",
        editorial_note:
          "Rummeligt og robust familietelt fra Helsport med plads til hele familien og grejet. Et trygt alround-valg til nordisk friluftsliv.",
        pros: ["God plads til familie + grej", "Robust nordisk kvalitet", "Alsidigt til 3 sæsoner"],
        cons: ["Tungt at bære langt", "Højere pris"],
        specs: { personer: 4, saeson: "3-sæsons" },
      },
      {
        product_id: "outmore-7029981043991",
        award_label: "Bedste til ekspedition",
        editorial_note:
          "Hardført ekspeditionstelt bygget til sne, vind og barske forhold. Til dig der camperer året rundt og vil have maksimal tryghed.",
        pros: ["Tåler sne og kraftig vind", "4-sæsons robusthed", "Premium Helsport-kvalitet"],
        cons: ["Høj pris", "Mere telt end de fleste behøver"],
        specs: { personer: 3, saeson: "4-sæsons" },
      },
      {
        product_id: "outmore-7340001627435",
        award_label: "Bedste lavvo",
        editorial_note:
          "Klassisk Tentipi-lavvo med masser af ståhøjde og plads til mange — og mulighed for brændeovn. Til længere ophold og koldt vejr.",
        pros: ["Stor ståhøjde og plads", "Velegnet til brændeovn", "Ikonisk Tentipi-kvalitet"],
        cons: ["Pakker stort og tungt", "Dyr"],
        specs: { personer: 9, saeson: "4-sæsons" },
      },
      {
        product_id: "backpackerlife-193657",
        award_label: "Bedste budget",
        editorial_note:
          "Billigt 2-personers telt til den første tur eller festivalen. Ikke til hårdt vejr, men en nem og overkommelig start.",
        pros: ["Meget lav pris", "Let at slå op", "Fint til milde forhold"],
        cons: ["Ikke til hårdt vejr", "Simpel materialekvalitet"],
        specs: { personer: 2, saeson: "2-3-sæsons" },
      },
    ],
  },
];

async function req(method, path, body, extraHeaders = {}) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...H, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function upsertGuide(g) {
  const { entries, ...guideRow } = g;
  guideRow.status = "published";
  const [row] = await req(
    "POST",
    "buying_guides?on_conflict=slug",
    guideRow,
    { Prefer: "resolution=merge-duplicates,return=representation" }
  );
  const guideId = row.id;

  let rank = 0;
  for (const e of entries) {
    await req(
      "POST",
      "buying_guide_entries?on_conflict=guide_id,affiliate_product_id",
      {
        guide_id: guideId,
        affiliate_product_id: e.product_id,
        rank: rank++,
        award_label: e.award_label ?? null,
        editorial_note: e.editorial_note ?? null,
        pros: e.pros ?? [],
        cons: e.cons ?? [],
      },
      { Prefer: "resolution=merge-duplicates" }
    );
    if (e.specs) {
      await req("PATCH", `affiliate_products?id=eq.${encodeURIComponent(e.product_id)}`, { specs: e.specs });
    }
  }
  return { slug: g.slug, guideId, entries: entries.length };
}

(async () => {
  for (const g of guides) {
    try {
      const res = await upsertGuide(g);
      console.log(`✓ ${res.slug} (${res.entries} produkter) → /bedste/${res.slug}`);
    } catch (err) {
      console.error(`✗ ${g.slug}: ${err.message}`);
    }
  }
  console.log("\nFærdig. Husk: live pris/lager hentes ved render; udsolgte demoteres automatisk.");
})();
