/**
 * Tilfoejer kontekstuelle interne links til de guider, der manglede dem.
 *
 * Koeres:
 *   npx tsx scripts/tilfoej-interne-links.ts --tjek    # viser kun
 *   npx tsx scripts/tilfoej-interne-links.ts           # skriver
 *
 * Maalt paa det levende site 26. oktober 2026 havde 25 af de 46 guider nul
 * brodtekst-link fra nogen anden guide, heraf fem af de otte nye: kikkert,
 * oekse, solhat, vandrebukser og vandresandal. Tre var reelt foraeldreloese med
 * kun hub-linket og intet andet: gamacher, handsker og kompas.
 *
 * "Se ogsaa"-modulet daekker til gengaeld de nye BEDRE end de etablerede, 10,4
 * indgaaende mod 5,1 i snit. Hullet er altsaa ikke antallet af links, men
 * typen: et link i "Se ogsaa" og i footeren laeser Google som navigation, mens
 * et link midt i en saetning med en begrundelse laeser som indhold.
 *
 * Saetningerne herunder er skrevet i sitets egen stil: en konkret grund, og
 * linket inde i saetningen frem for en henvisning klistret paa til sidst.
 *
 * last_reviewed_at roeres IKKE. At tilfoeje en saetning er ikke en gennemgang
 * af guidens produkter, og sundhedstjekket skal ikke tro noget andet.
 */
import { createClient } from "@supabase/supabase-js";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
} catch {
  /* dotenv ikke tilgaengelig */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

interface Tilfoejelse {
  /** Guiden teksten skrives I. */
  kilde: string;
  /** Guiderne linket peger PAA, til kontrol. */
  maal: string[];
  /** Den afsluttende tekst i det afsnit der udvides. Skal findes præcis én gang. */
  efter: string;
  /** Det der saettes ind umiddelbart efter. */
  tekst: string;
}

const TILFOEJELSER: Tilfoejelse[] = [
  {
    kilde: "vandresko",
    maal: ["vandresandal"],
    efter: "og fylder mindre, hvis du vil have et par lette sko med til lejren oveni.",
    tekst:
      " Til netop det par er en [vandresandal](/bedste/vandresandal) ofte bedre end en ekstra sko: den tørrer, uanset hvor våd den bliver, og den kan tages på med sokker, når aftenen køler.",
  },
  {
    kilde: "vandrestovler",
    maal: ["vandresandal"],
    efter: "Tommelfingerregel: jo tungere rygsæk og jo mere ujævnt terræn, jo højere skaft.",
    tekst:
      " Skal du vade over et vandløb undervejs, er en [vandresandal](/bedste/vandresandal) i rygsækken billigere end at gå resten af dagen i våde støvler.",
  },
  {
    kilde: "vandrestovler",
    maal: ["gamacher"],
    efter: "Til tørre højsommerture kan en ikke-membran model ånde bedre.",
    tekst:
      " Membranen stopper i øvrigt ikke det vand, der løber ned ad skinnebenet og ind over skaftkanten, og det er præcis det, [gamacher](/bedste/gamacher) laver om på i vådt græs.",
  },
  {
    kilde: "regntoj",
    maal: ["vandrebukser"],
    efter: "- **Poncho:** let, billig, dækker også rygsækken, men flagrer i vind. God backup eller til lejren.",
    tekst:
      "\n\nRegnbukserne er kun et skal-lag. Går du i vedvarende regn, er et par hurtigtørrende [vandrebukser](/bedste/vandrebukser) indenunder mere behagelige end en tyk bukse, der suger vand og bliver tung.",
  },
  {
    kilde: "uldundertoj",
    maal: ["fleece", "vandrebukser"],
    efter: "du kan tage underdelen af, hvis det bliver lunt.",
    tekst:
      " Laget udenover afgør, hvor meget uld du har brug for: med en [fleece](/bedste/fleece) som mellemlag rækker 150-200 g/m² langt, og på benene holder et tyndt lag under et par [vandrebukser](/bedste/vandrebukser) bedre varmen end én tyk bukse alene.",
  },
  {
    kilde: "hue",
    maal: ["solhat", "handsker"],
    efter: "En tynd hue kan også bæres under jakkens hætte som ekstra lag på de koldeste dage.",
    tekst:
      " Om sommeren vender behovet: der er det skygge frem for isolering, og så er en [solhat](/bedste/solhat) den rigtige hovedbeklædning. Hænderne er det næste sted, varmen forsvinder, så en hue uden [handsker](/bedste/handsker) løser kun det halve.",
  },
  {
    kilde: "myggenet",
    maal: ["solhat"],
    efter: "Nettet plus balsam dækker stort set alle situationer.",
    tekst:
      " En bredskygget [solhat](/bedste/solhat) holder nettet længere væk fra ansigtet end en kasket og giver skygge samtidig, så den løser to ting på én gang.",
  },
  {
    kilde: "kniv",
    maal: ["oekse"],
    efter: "tager du på længere ophold, er en fastkniv rar.",
    tekst:
      " Begge stopper dog ved brænde: skal det kløves, er det en [økse eller en sav](/bedste/oekse), der skal med, og en kniv brugt som kile ødelægger både æg og greb.",
  },
  {
    kilde: "taendstaal",
    maal: ["oekse"],
    efter: "Medbragt tinder er billig forsikring mod en kold aften.",
    tekst:
      " Det tørre ved sidder desuden inde i brændet og ikke udenpå: en [økse eller en foldesav](/bedste/oekse) giver dig kløvede flader, der tænder, selv når barken er våd.",
  },
  {
    kilde: "kompas",
    maal: ["kikkert"],
    efter: "Når teknikken sidder, er kort og kompas en ro i baghovedet på enhver tur.",
    tekst:
      " Øvelsen bliver nemmere med en [kikkert](/bedste/kikkert): kan du læse et kirketårn eller en skovkant på afstand, har du et pejlemærke at tage kursen imod frem for at gætte.",
  },
  {
    kilde: "kikkert",
    maal: ["kompas"],
    efter: "kan du ikke sidde tørt i en time, kigger du ikke i en time.",
    tekst:
      " Den samme kikkert er også et navigationsværktøj: ser du et pejlemærke, du kan genkende på kortet, kan du tage en kurs mod det med et [kompas](/bedste/kompas).",
  },
  {
    kilde: "tarp",
    maal: ["kikkert"],
    efter: "om du primært skal dække en bålplads, en hængekøje eller dig selv.",
    tekst:
      " Den tørre plads er også grunden til, at en tarp og en [kikkert](/bedste/kikkert) hører sammen: dyrene kommer tættere på den, der bliver siddende, og det gør man kun, hvis man sidder tørt.",
  },
];

async function main() {
  const kunTjek = process.argv.includes("--tjek");

  const slugs = [...new Set(TILFOEJELSER.map((t) => t.kilde))];
  const { data, error } = await sb
    .from("buying_guides")
    .select("id, slug, body_md")
    .in("slug", slugs);
  if (error) {
    console.error(`buying_guides: ${error.message}`);
    process.exit(1);
  }
  const guider = new Map((data ?? []).map((g) => [g.slug, g]));

  // Flere tilfoejelser kan ramme samme guide, saa teksten bygges op i hukommelsen.
  const nyTekst = new Map<string, string>();
  let sprunget = 0;

  for (const t of TILFOEJELSER) {
    const g = guider.get(t.kilde);
    if (!g) {
      console.error(`${t.kilde}: findes ikke`);
      process.exit(1);
    }
    const nuvaerende = nyTekst.get(t.kilde) ?? g.body_md ?? "";

    // Allerede tilfoejet? Saa er scriptet koert foer.
    if (t.maal.every((m) => nuvaerende.includes(`(/bedste/${m})`))) {
      console.log(`  ${t.kilde} -> ${t.maal.join(", ")}: link findes allerede, springer over`);
      sprunget++;
      continue;
    }
    const antal = nuvaerende.split(t.efter).length - 1;
    if (antal !== 1) {
      console.error(`${t.kilde}: ankeret findes ${antal} gange, forventede 1:\n  "${t.efter}"`);
      process.exit(1);
    }
    nyTekst.set(t.kilde, nuvaerende.replace(t.efter, t.efter + t.tekst));
    console.log(`  ${t.kilde} -> ${t.maal.join(", ")}  (+${t.tekst.trim().length} tegn)`);
  }

  console.log(`\n${nyTekst.size} guider aendres, ${sprunget} tilfoejelser sprunget over`);
  if (kunTjek) {
    for (const [slug, tekst] of nyTekst) {
      const foer = (guider.get(slug)!.body_md ?? "").length;
      console.log(`  ${slug.padEnd(16)} ${foer} -> ${tekst.length} tegn`);
    }
    console.log("\n--tjek: intet skrevet");
    return;
  }

  for (const [slug, body_md] of nyTekst) {
    const { error: e2 } = await sb.from("buying_guides").update({ body_md }).eq("slug", slug);
    if (e2) {
      console.error(`${slug}: ${e2.message}`);
      process.exit(1);
    }
  }
  console.log(`\nopdateret: ${nyTekst.size} guider`);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
