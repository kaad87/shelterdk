/**
 * Retter de tekstkvalitetsfejl, den eksterne SEO-audit fandt 27. oktober 2026,
 * plus de forekomster auditten ikke kunne se fra ydersiden.
 *
 *   npx tsx scripts/ret-tekstkvalitet.ts --tjek    # viser hver aendring
 *   npx tsx scripts/ret-tekstkvalitet.ts           # skriver
 *
 * Tre ting rettes:
 *
 * 1. "test" i seo_title. /saadan-vurderer-vi siger, at vi ikke har et testlab
 *    og ikke laver fysiske tests. Seks guider lovede alligevel "test" i selve
 *    SERP-snippet'et, altsaa det mest synlige sted af alle.
 *
 * 2. "ikke oplyst i feedet" i 62 entries. Det er IKKE en intern note, der er
 *    sluppet ud: at en vaegt mangler er et reelt forbehold, og laeseren skal
 *    have det at vide. Men "feedet" er vores plumbing og betyder intet for en
 *    gaest, saa det bliver "af forhandleren". Oplysningen bevares, jargonen
 *    ryger. Den ene aegte interne note, "Flyttet hertil fra sommersovepose-
 *    guiden", slettes.
 *
 * 3. aeoeaa skrevet som ae/oe/aa. Ordlisten er eksplicit frem for et moenster,
 *    fordi dansk har rigtige ord med de samme bogstavpar: "skoen", "skoene",
 *    "kanoen", "broen", "risikoen", "kuldebroer", "ponchoer", "protozoer",
 *    "trangiaen", "tempoet" og "valutaen" staar alle i teksterne og er korrekte.
 *    Slugs som "saadan-vurderer-vi", "stormkoekken", "oekse", "taendstaal",
 *    "letvaegtstelt" og "vandrerygsaek" er ogsaa korrekte, saa URL'er maskeres
 *    foer erstatningen og laegges tilbage efter.
 *
 * Idempotent: anden koersel finder ingenting.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/** Nye seo_title uden ordet "test". Vinklen er beholdt, aarstal og brand uaendret. */
const SEO_TITLER: Record<string, string> = {
  "sovepose-til-boern": "Bedste børnesovepose 2026 – varme valg til shelter | ShelterDK",
  "sovepose-til-vinter": "Bedste sovepose til vinter 2026 – komforttemperatur forklaret | ShelterDK",
  tarp: "Bedste tarp 2026 – købsguide til shelter og bivuak | ShelterDK",
  telt: "Bedste telt 2026 – købsguide til shelterture | ShelterDK",
  vandfilter: "Bedste vandfilter & vandrenser 2026 – købsguide | ShelterDK",
  vandrerygsaek: "Bedste vandrerygsæk 2026 – bæresystem og liter forklaret | ShelterDK",
};

/** Den ene saetning, der er redaktionel husholdning og ikke vedkommer laeseren. */
const INTERN_NOTE = " Flyttet hertil fra sommersovepose-guiden, som er lagt sammen med denne.";

/**
 * Forkert -> rigtigt, kun hele ord. Listen er udtoemmende for de 46 guider og
 * deres entries pr. 27. oktober 2026; den er eksplicit, saa et nyt ord ikke
 * bliver rettet ved et uheld.
 */
const ORD: Record<string, string> = {
  paa: "på",
  saa: "så",
  saadan: "sådan",
  altsaa: "altså",
  ogsaa: "også",
  naar: "når",
  faar: "får",
  baade: "både",
  graa: "grå",
  haard: "hård",
  taaler: "tåler",
  daarligt: "dårligt",
  maaneder: "måneder",
  udgaaet: "udgået",
  grannaale: "grannåle",
  pakmaal: "pakmål",
  pakmaalet: "pakmålet",
  "trækbaand": "trækbånd",
  vaere: "være",
  vaegten: "vægten",
  vaelge: "vælge",
  baeres: "bæres",
  baerer: "bærer",
  haenge: "hænge",
  haenger: "hænger",
  haengekoeje: "hængekøje",
  ryglaen: "ryglæn",
  saet: "sæt",
  saettes: "sættes",
  spaendes: "spændes",
  "gengaeld": "gengæld",
  selvstaendigt: "selvstændigt",
  traeharpiks: "træharpiks",
  koebe: "købe",
  hoerer: "hører",
  hoejt: "højt",
  hoeje: "høje",
  oevrige: "øvrige",
  uldtoej: "uldtøj",
  foerstevalg: "førstevalg",
  medfoelgende: "medfølgende",
};

const ORD_RE = new RegExp(`\\b(${Object.keys(ORD).join("|")})\\b`, "gi");

/** Markdown-linkmaal og bare stier. Maskeres, saa slugs ikke "rettes". */
const URL_RE = /\]\([^)]*\)|\bhttps?:\/\/\S+|(?<=[\s("'])\/[a-z0-9/-]+/gi;

function stortBegyndelsesbogstav(kilde: string, ny: string): string {
  return kilde[0] === kilde[0].toUpperCase() ? ny[0].toUpperCase() + ny.slice(1) : ny;
}

/** Retter aeoeaa i loebende tekst, men aldrig inde i en URL. */
export function retOrd(tekst: string): string {
  const gemt: string[] = [];
  const maskeret = tekst.replace(URL_RE, (m) => {
    gemt.push(m);
    return `\u0000${gemt.length - 1}\u0000`;
  });
  const rettet = maskeret.replace(ORD_RE, (m) => stortBegyndelsesbogstav(m, ORD[m.toLowerCase()]));
  return rettet.replace(/\u0000(\d+)\u0000/g, (_, i) => gemt[Number(i)]);
}

/** Alle tre rettelser paa én tekst. */
export function retTekst(tekst: string): string {
  return retOrd(tekst.split(INTERN_NOTE).join("").replace(/oplyst i feedet/gi, "oplyst af forhandleren"));
}

type Raekke = Record<string, unknown> & { id: string };

/** Felter der er ren tekst, og felter der er tekst-arrays. */
const GUIDE_TEKST = ["intro", "body_md", "seo_description"] as const;
const ENTRY_TEKST = ["editorial_note", "best_for"] as const;
const ENTRY_LISTE = ["pros", "cons"] as const;

async function main() {
  const kunTjek = process.argv.includes("--tjek");
  let aendringer = 0;

  const vis = (hvor: string, foer: string, efter: string) => {
    aendringer++;
    if (!kunTjek) return;
    // Vis kun de stykker, der faktisk flytter sig, ikke hele feltet.
    const fOrd = foer.split(/(\s+)/);
    const eOrd = efter.split(/(\s+)/);
    const diff: string[] = [];
    for (let i = 0; i < Math.max(fOrd.length, eOrd.length); i++)
      if (fOrd[i] !== eOrd[i]) diff.push(`${fOrd[i] ?? "(intet)"} -> ${eOrd[i] ?? "(intet)"}`);
    console.log(`  ${hvor}: ${diff.slice(0, 8).join(" | ")}${diff.length > 8 ? ` (+${diff.length - 8})` : ""}`);
  };

  // 1. seo_title
  console.log("seo_title uden \"test\":");
  for (const [slug, seo_title] of Object.entries(SEO_TITLER)) {
    const { data, error } = await sb.from("buying_guides").select("id, seo_title").eq("slug", slug).maybeSingle();
    if (error || !data) {
      console.error(`  ${slug}: ${error?.message ?? "findes ikke"}`);
      process.exit(1);
    }
    if (data.seo_title === seo_title) continue;
    if (!/\btest/i.test(data.seo_title ?? "")) {
      console.log(`  ${slug}: siger ikke "test" laengere, springer over`);
      continue;
    }
    console.log(`  ${slug}:\n    foer:  ${data.seo_title}\n    efter: ${seo_title}`);
    aendringer++;
    if (!kunTjek) {
      const { error: e2 } = await sb.from("buying_guides").update({ seo_title }).eq("id", data.id);
      if (e2) { console.error(`  ${slug}: ${e2.message}`); process.exit(1); }
    }
  }

  // 2+3. guider
  console.log("\nguider (intro, body_md, seo_description, faq):");
  const { data: guider, error: gErr } = await sb
    .from("buying_guides")
    .select("id, slug, intro, body_md, seo_description, faq")
    .eq("status", "published");
  if (gErr) { console.error(gErr.message); process.exit(1); }
  for (const g of (guider ?? []) as Raekke[]) {
    const opdat: Record<string, unknown> = {};
    for (const f of GUIDE_TEKST) {
      const v = g[f] as string | null;
      if (!v) continue;
      const ny = retTekst(v);
      if (ny !== v) { opdat[f] = ny; vis(`${g.slug}.${f}`, v, ny); }
    }
    // faq er jsonb: ret hvert spoergsmaal og svar for sig, saa strukturen staar.
    const faq = g.faq as { q?: string; a?: string; question?: string; answer?: string }[] | null;
    if (faq?.length) {
      const nyFaq = faq.map((f) => {
        const ud: typeof f = { ...f };
        for (const k of ["q", "a", "question", "answer"] as const)
          if (typeof ud[k] === "string") ud[k] = retTekst(ud[k] as string);
        return ud;
      });
      if (JSON.stringify(nyFaq) !== JSON.stringify(faq)) {
        opdat.faq = nyFaq;
        vis(`${g.slug}.faq`, JSON.stringify(faq), JSON.stringify(nyFaq));
      }
    }
    if (!Object.keys(opdat).length) continue;
    if (!kunTjek) {
      const { error } = await sb.from("buying_guides").update(opdat).eq("id", g.id);
      if (error) { console.error(`${g.slug}: ${error.message}`); process.exit(1); }
    }
  }

  // 2+3. entries
  console.log("\nentries (editorial_note, best_for, pros, cons):");
  const { data: slugs } = await sb.from("buying_guides").select("id, slug");
  const slugAf = new Map((slugs ?? []).map((x) => [x.id as string, x.slug as string]));
  const { data: entries, error: eErr } = await sb
    .from("buying_guide_entries")
    .select("id, guide_id, editorial_note, best_for, pros, cons");
  if (eErr) { console.error(eErr.message); process.exit(1); }
  for (const e of (entries ?? []) as Raekke[]) {
    const opdat: Record<string, unknown> = {};
    for (const f of ENTRY_TEKST) {
      const v = e[f] as string | null;
      if (!v) continue;
      const ny = retTekst(v);
      if (ny !== v) { opdat[f] = ny; vis(`${slugAf.get(e.guide_id as string)}.${f}`, v, ny); }
    }
    for (const f of ENTRY_LISTE) {
      const v = e[f] as string[] | null;
      if (!v?.length) continue;
      const ny = v.map(retTekst);
      if (JSON.stringify(ny) !== JSON.stringify(v)) {
        opdat[f] = ny;
        vis(`${slugAf.get(e.guide_id as string)}.${f}`, v.join(" ~ "), ny.join(" ~ "));
      }
    }
    if (!Object.keys(opdat).length) continue;
    if (!kunTjek) {
      const { error } = await sb.from("buying_guide_entries").update(opdat).eq("id", e.id);
      if (error) { console.error(`entry ${e.id}: ${error.message}`); process.exit(1); }
    }
  }

  console.log(`\n${aendringer} aendringer${kunTjek ? " (--tjek: intet skrevet)" : " skrevet"}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
