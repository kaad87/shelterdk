"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Soejlegraf, StabletAreal, Sparkline, Bjaelker, Varmekort, Retning, SERIE_FARVER,
} from "@/components/admin/Grafer";

const STORAGE_KEY = "shelterdk-admin-secret";

interface Bucket {
  navn: string; klik: number; andel: number; vaerdi: number;
  nu7: number; foer7: number; serie: number[];
}
interface Dag {
  dato: string; klik: number; vaerdi: number;
  grejVisninger: number; grejKlik: number; guideVisninger: number; bookingKlik: number;
}
interface Data {
  genereret: string;
  vindue: { dage: number; periode: number; fra: string | null; til: string | null };
  noegletal: {
    klik: number; klikForrige: number; vaerdi: number; vaerdiForrige: number;
    vaerdiUdenTop: number; vaerdiUdenTopForrige: number;
    topAndel: number; faaBaererVaerdien: boolean;
    medianPris: number | null; guiderMedKlik: number; andelFraGuider: number;
    grejVisninger: number; grejKlik: number; grejRate: number | null;
  };
  serie: Dag[];
  glidende: { klik: number[]; vaerdi: number[]; grejVisninger: number[] };
  guider: Bucket[]; forhandlere: Bucket[]; placeringer: Bucket[]; kilder: Bucket[];
  kategorier: Bucket[]; stier: Bucket[];
  forhandlerMix: { datoer: string[]; serier: { navn: string; vaerdier: number[] }[] };
  produkter: { navn: string; brand: string | null; forhandler: string | null;
    kategori: string | null; pris: number | null; klik: number }[];
  varmekort: number[][];
  prisfordeling: { fra: number; til: number; antal: number }[];
  sundhed: {
    guider: number; medProblemer: number; pladser: number; doedePladser: number;
    problemer: { slug: string; problems: string[] }[];
    koncentration: number; enForhandler: number;
  };
  shelters: {
    noegletal: Data["noegletal"];
    serie: Dag[];
    produkter: Data["produkter"];
    forhandlere: Bucket[];
  };
  katalog: { ialt: number | null; koebbare: number | null };
  daekning: { foersteKlik: string | null; foersteEvent: string | null;
    klikRaekker: number; eventRaekker: number };
}

const tal = (n: number) => n.toLocaleString("da-DK", { maximumFractionDigits: 0 });
const kr = (n: number) => `${tal(n)} kr.`;
// Decimalkomma og ikke punktum: "3.2 %" er ikke dansk. Decimalen vises kun
// under 10 %, hvor forskellen mellem 3 % og 3,2 % betyder noget.
const pct = (n: number) =>
  `${(n * 100).toLocaleString("da-DK", {
    minimumFractionDigits: n < 0.1 ? 1 : 0, maximumFractionDigits: n < 0.1 ? 1 : 0,
  })} %`;

/**
 * Nøgletalskort.
 *
 * Tallet skal dominere. En første udgave satte titlen med versaler, fed og
 * sperring og lagde forklaringen under som en understreget "Hvad betyder
 * det?" — på en telefon fyldte titlen to linjer og forklaringslinket var
 * visuelt stærkere end selve tallet. Nu er titlen lille og rolig på én
 * linje, forklaringen ligger bag et ⓘ i hjørnet, og kortene har samme
 * struktur, så tallene flugter på tværs af rækken.
 */
function Kort({ titel, periode, vaerdi, under, forklaring }: {
  titel: string; periode?: string; vaerdi: string;
  under?: React.ReactNode; forklaring?: string;
}) {
  const [åben, setÅben] = useState(false);
  return (
    <div className="relative flex flex-col rounded-xl border border-primary/10 bg-white p-3.5 shadow-[0_1px_2px_rgba(44,62,80,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium leading-tight text-primary/85">
          {titel}
          {periode && <span className="text-primary/70"> · {periode}</span>}
        </h3>
        {forklaring && (
          <button type="button" onClick={() => setÅben((v) => !v)}
            aria-expanded={åben} aria-label={`Forklaring til ${titel}`}
            className="-mr-1 -mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold text-primary/70 outline-none ring-1 ring-primary/15 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-accent">
            <span aria-hidden>i</span>
          </button>
        )}
      </div>
      <p className="mt-1.5 font-serif text-[1.7rem] font-bold leading-none tabular-nums text-primary">
        {vaerdi}
      </p>
      {under && <div className="mt-2 text-xs text-primary/80">{under}</div>}
      {åben && forklaring && (
        <p className="mt-2 border-t border-primary/10 pt-2 text-[0.7rem] leading-snug text-primary/85">
          {forklaring}
        </p>
      )}
    </div>
  );
}

function Panel({ titel, note, children, handling }: {
  titel: string; note?: string; children: React.ReactNode; handling?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-primary/10 bg-white p-4 shadow-[0_1px_2px_rgba(44,62,80,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-bold text-primary">{titel}</h2>
          {note && <p className="mt-0.5 max-w-prose text-xs leading-snug text-primary/75">{note}</p>}
        </div>
        {handling}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

const TH = "py-2 pr-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-primary/75";

type Sortering = "klik" | "vaerdi" | "nu7" | "navn";

export function AdminAffiliatePerformance() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  const [henter, setHenter] = useState(false);
  const [dage, setDage] = useState(90);
  const [periode, setPeriode] = useState(28);
  const [sorter, setSorter] = useState<Sortering>("klik");

  // Hvert kald får et løbenummer. Uden det kunne et langsomt ældre svar
  // lande efter et nyere og overskrive det — skifter man vindue to gange
  // hurtigt, stod der så data for det forkerte vindue under den nye etiket.
  const løbenr = useRef(0);

  const hent = useCallback(async () => {
    if (!secret) return;
    const mit = ++løbenr.current;
    setHenter(true);
    try {
      const r = await fetch(`/api/admin/affiliate-performance?dage=${dage}&periode=${periode}`, {
        headers: { "x-admin-secret": secret },
        cache: "no-store",
      });
      if (mit !== løbenr.current) return;
      if (!r.ok) {
        const krop = await r.json().catch(() => ({}));
        setFejl(r.status === 401
          ? "Forkert admin secret."
          : `Kunne ikke hente data (${r.status}). ${krop.error ?? ""}`.trim());
        return;
      }
      setData(await r.json());
      setFejl(null);
    } catch (e) {
      if (mit !== løbenr.current) return;
      setFejl(e instanceof Error ? e.message : "Kunne ikke hente data.");
    } finally {
      if (mit === løbenr.current) setHenter(false);
    }
  }, [secret, dage, periode]);

  useEffect(() => {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s) setSecret(s);
  }, []);
  useEffect(() => { void hent(); }, [hent]);

  // "Løbende opdateret": henter sig selv hvert 5. minut. Intervallet ryddes
  // op ved unmount og ved hvert skift af vindue, så der ikke hober sig
  // timere op.
  useEffect(() => {
    if (!secret) return;
    const t = setInterval(() => { void hent(); }, 5 * 60_000);
    return () => clearInterval(t);
  }, [secret, hent]);

  const guiderSorteret = useMemo(() => {
    if (!data) return [];
    const r = [...data.guider];
    if (sorter === "navn") return r.sort((a, b) => a.navn.localeCompare(b.navn, "da"));
    return r.sort((a, b) => b[sorter] - a[sorter] || a.navn.localeCompare(b.navn, "da"));
  }, [data, sorter]);

  if (!secret) {
    return (
      <form className="max-w-sm" onSubmit={(e) => {
        e.preventDefault();
        if (!input) return;
        sessionStorage.setItem(STORAGE_KEY, input);
        setSecret(input);
      }}>
        <label htmlFor="admin-secret" className="block text-sm font-medium text-primary">
          Admin secret
        </label>
        <input id="admin-secret" type="password" value={input} autoComplete="current-password"
          onChange={(e) => setInput(e.target.value)}
          className="mt-1 w-full rounded-lg border border-primary/15 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
        <button type="submit"
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white outline-none hover:bg-accent-dark focus-visible:ring-2 focus-visible:ring-accent/60">
          Log ind
        </button>
      </form>
    );
  }

  // Et nyt forsøg der fejler må ikke tage de tal væk, der allerede står —
  // en forbigående 500'er blankede før hele siden. Fejlen vises som et
  // banner over de data vi har, og det siges hvor gamle de er.
  const fejlbanner = fejl ? (
    <div role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#A8744F]/35 bg-[#A8744F]/[0.07] px-3.5 py-2.5 text-sm text-primary">
      <span className="font-medium">{fejl}</span>
      {data && (
        <span className="text-primary/80">
          Viser tal fra {new Date(data.genereret).toLocaleTimeString("da-DK",
            { hour: "2-digit", minute: "2-digit" })}.
        </span>
      )}
      <button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setSecret(""); setFejl(null); }}
        className="underline underline-offset-2">Skift secret</button>
    </div>
  ) : null;

  if (!data) {
    return (
      <div className="space-y-4">
        {fejlbanner}
        {!fejl && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[5.5rem] animate-pulse rounded-xl bg-primary/[0.05]" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const n = data.noegletal;
  const p = data.vindue.periode;
  const harEvents = data.daekning.eventRaekker > 0;
  const grejSerie = data.serie.map((d) => ({ dato: d.dato, vaerdi: d.grejVisninger }));
  const sum = (f: (d: Dag) => number) => data.serie.reduce((s, d) => s + f(d), 0);
  const sh = data.shelters.noegletal;

  // Overskriften på hele siden: én sætning om hvad der er sket. Et dashboard
  // man skal læse tre grafer i for at vide om det går frem eller tilbage,
  // har udskudt sit eget arbejde til læseren.
  const ændring = n.klikForrige > 0
    ? Math.round(((n.klik - n.klikForrige) / n.klikForrige) * 100) : null;
  const overskrift = ændring === null
    ? `${tal(n.klik)} klik på grej i ${p} dage.`
    : `${tal(n.klik)} klik på grej i ${p} dage — ${
        ændring >= 0 ? "op" : "ned"} ${Math.abs(ændring)} % mod de ${p} dage før.`;
  const pctÆndring = (nu: number, foer: number) =>
    foer > 0 ? Math.round(((nu - foer) / foer) * 100) : null;
  const vaerdiÆndring = pctÆndring(n.vaerdi, n.vaerdiForrige);
  const robustÆndring = pctÆndring(n.vaerdiUdenTop, n.vaerdiUdenTopForrige);

  // Klik og værdi kan pege hver sin vej, og det er den interessante nuance.
  // Men den må kun kaldes en tendens, hvis den overlever at de dyreste klik
  // tages ud. Første udgave skrev "færre klik, men på dyrere varer" om et
  // tal, hvor fire klik på shelter-byggesæt stod for 39 % af beløbet: uden
  // dem var værdien faldet 25 % og fulgte klikkene ned. En artefakt sat med
  // den største skrift på siden er værre end ingen overskrift.
  // "+0 %" er en afrundet nul-ændring og læses som en stigning. Den skal
  // hedde det den er.
  const fortegn = (v: number) => (v === 0 ? "uændret" : `${v > 0 ? "+" : "−"}${Math.abs(v)} %`);
  let nuance = "";
  if (n.faaBaererVaerdien && vaerdiÆndring !== null && robustÆndring !== null) {
    nuance = `Den klikkede værdi steg ${vaerdiÆndring > 0 ? "+" : ""}${vaerdiÆndring} %, men de tre dyreste `
      + `klik alene står for ${pct(n.topAndel)} af beløbet — uden dem er den `
      + `${robustÆndring === 0 ? "uændret" : fortegn(robustÆndring)}.`;
  } else if (ændring !== null && vaerdiÆndring !== null
      && Math.sign(ændring) !== Math.sign(vaerdiÆndring)) {
    nuance = `Den klikkede værdi gik modsat (${fortegn(vaerdiÆndring)}) — færre klik, `
      + "men på dyrere varer.";
  }

  return (
    <div className="space-y-5">
      {fejlbanner}

      {/* ---- Hovedbudskab ---- */}
      <div>
        <p className="font-serif text-lg leading-snug text-primary">{overskrift}</p>
        {nuance && (
          <p className="mt-0.5 text-sm leading-snug text-primary/85">{nuance}</p>
        )}
      </div>

      {/* ---- Styring ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/10 bg-white px-3.5 py-2.5 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-primary/85">Graf-vindue</span>
          <select value={dage} onChange={(e) => setDage(Number(e.target.value))}
            className="rounded-lg border border-primary/15 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            {[14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} dage</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-primary/85">Nøgletal</span>
          <select value={periode} onChange={(e) => setPeriode(Number(e.target.value))}
            className="rounded-lg border border-primary/15 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            {[7, 14, 28, 90].map((d) => <option key={d} value={d}>{d} dage</option>)}
          </select>
        </label>
        <button onClick={() => void hent()} disabled={henter}
          className="rounded-lg border border-primary/15 px-3 py-1 outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50">
          {henter ? "Henter…" : "Opdater"}
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-primary/75"
          aria-live="polite">
          <span aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${henter ? "animate-pulse bg-accent" : "bg-pine/60"}`} />
          Opdateret {new Date(data.genereret).toLocaleTimeString("da-DK",
            { hour: "2-digit", minute: "2-digit" })} · fornyer sig hvert 5. minut
        </span>
      </div>

      {/* ---- Nøgletal ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kort titel="Klik på grej" periode={`${p} dage`} vaerdi={tal(n.klik)}
          under={<Retning nu={n.klik} foer={n.klikForrige} />}
          forklaring="Klik videre til en forhandler. Det er det nærmeste vi kommer en salgshandling i vores egne data." />
        <Kort titel="Klikket værdi" periode={`${p} dage`} vaerdi={kr(n.vaerdi)}
          under={
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Retning nu={n.vaerdi} foer={n.vaerdiForrige} />
              {n.faaBaererVaerdien && (
                <span className="text-[0.7rem] text-primary/80">
                  heraf {pct(n.topAndel)} fra 3 klik
                </span>
              )}
            </div>
          }
          forklaring={"Listepriserne på de klikkede varer lagt sammen — summen af hvad folk klikkede videre på, "
            + "ikke omsætning: kun en del bliver køb, og provisionen er en procentdel af beløbet. "
            + "Et enkelt klik på et shelter-byggesæt til 20.000 kr. vejer lige så meget som 33 soveposer, "
            + "så læs medianen ved siden af, når få klik bærer summen."} />
        <Kort titel="Median varepris" vaerdi={n.medianPris != null ? kr(n.medianPris) : "–"}
          forklaring="Median og ikke gennemsnit, så en enkelt dyr vare ikke flytter tallet." />
        <Kort titel="Guider med klik" vaerdi={tal(n.guiderMedKlik)}
          under={<span>{pct(n.andelFraGuider)} af klik kom fra /bedste</span>} />
        <Kort titel="Grejblok-rate" vaerdi={n.grejRate != null ? pct(n.grejRate) : "–"}
          under={<span>{tal(n.grejKlik)} af {tal(n.grejVisninger)} visninger</span>}
          forklaring="Klik på et grej-forslag på en shelter-side, delt med antal gange blokken blev set." />
        <Kort titel="Købbare varer" vaerdi={data.katalog.koebbare != null ? tal(data.katalog.koebbare) : "–"}
          under={<span>af {tal(data.katalog.ialt ?? 0)} i feedet</span>} />
      </div>

      {/* Shelters står for sig: 0,8 % af klikkene, men 15 % af værdien.
          Linjen her, så det samlede billede ikke mangler dem. */}
      {sh.klik > 0 && (
        <p className="text-sm text-primary/85">
          Dertil <strong className="font-medium text-primary">{tal(sh.klik)} klik på
          shelters og byggesæt</strong> til {kr(sh.vaerdi)} — opgjort for sig længere nede,
          fordi en enkelt bygning til 20.000 kr. vejer som 33 soveposer.
        </p>
      )}

      {/* ---- Udvikling ---- */}
      <Panel titel="Klik på grej pr. dag"
        note={`${data.vindue.fra} – ${data.vindue.til}. Shelters og byggesæt tælles ikke med — de har deres eget panel. Søjler er den enkelte dag, linjen er 7-dages gennemsnit; peg på en dag for tallet.`}>
        <Soejlegraf data={data.serie.map((d) => ({ dato: d.dato, vaerdi: d.klik }))}
          linje={data.glidende.klik} enhed=" klik" />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titel="Klikket værdi pr. dag"
          note="Listepris på det klikkede grej — et mål for købsintention, ikke for omsætning.">
          <Soejlegraf data={data.serie.map((d) => ({ dato: d.dato, vaerdi: d.vaerdi }))}
            linje={data.glidende.vaerdi} enhed=" kr." />
        </Panel>
        <Panel titel="Forhandler-mix over tid"
          note="Stablet, i absolutte klik. En flade der skrumper, fordi de andre voksede, ville i en procentgraf se ud som et fald.">
          <StabletAreal datoer={data.forhandlerMix.datoer} serier={data.forhandlerMix.serier} />
        </Panel>
      </div>

      {/* ---- Guider ---- */}
      <Panel titel="Pr. købsguide"
        note={`Klik i hele graf-vinduet (${data.vindue.dage} dage). “Retning” sammenligner de seneste 7 dage med de 7 før dem.`}
        handling={
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-primary/85">
            Sortér
            <select value={sorter} onChange={(e) => setSorter(e.target.value as Sortering)}
              className="rounded-lg border border-primary/15 px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
              <option value="klik">Flest klik</option>
              <option value="vaerdi">Størst værdi</option>
              <option value="nu7">Mest aktive nu</option>
              <option value="navn">Navn</option>
            </select>
          </label>
        }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Affiliate-klik pr. købsguide i de seneste {data.vindue.dage} dage.
            </caption>
            <thead>
              <tr className="border-b border-primary/15">
                <th scope="col" className={TH}>Guide</th>
                <th scope="col" className={`${TH} text-right`}>Klik</th>
                <th scope="col" className={`${TH} text-right`}>Andel</th>
                <th scope="col" className={`${TH} text-right`}>Værdi</th>
                <th scope="col" className={`${TH} text-right`}>7 d</th>
                <th scope="col" className={TH}>Retning</th>
                <th scope="col" className={TH}>Udvikling</th>
              </tr>
            </thead>
            <tbody>
              {guiderSorteret.map((b) => (
                <tr key={b.navn} className="border-b border-primary/[0.07] hover:bg-primary/[0.02]">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {b.navn === "(ingen)" ? (
                      <span className="text-primary/80">uden for /bedste</span>
                    ) : (
                      <a href={`/bedste/${b.navn}`} target="_blank" rel="noreferrer"
                        className="text-primary underline-offset-2 hover:text-accent-dark hover:underline">
                        {b.navn}
                      </a>
                    )}
                  </th>
                  <td className="py-1.5 pr-3 text-right font-medium tabular-nums">{tal(b.klik)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/80">{pct(b.andel)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/80">{kr(b.vaerdi)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{tal(b.nu7)}</td>
                  <td className="py-1.5 pr-3"><Retning nu={b.nu7} foer={b.foer7} /></td>
                  <td className="py-1.5">
                    <Sparkline tal={b.serie} titel={`${b.navn}: ${tal(b.klik)} klik i perioden`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- Fordelinger ---- */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Panel titel="Placering på siden" note="Hvor på guiden knappen blev trykket.">
          <Bjaelker poster={data.placeringer.map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
        <Panel titel="Forhandler">
          <Bjaelker poster={data.forhandlere.map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
        <Panel titel="Kategori" note="De tolv største.">
          <Bjaelker poster={data.kategorier.slice(0, 12).map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
        <Panel
          titel="Kanal"
          note="Hvor besøget kom fra. Kun målt siden referreren begyndte at blive gemt, så ældre klik står som ukendt."
        >
          <Bjaelker poster={(data.kilder ?? []).map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titel="Prisfordeling på klikkede varer"
          note="Faste trin, så svaret på “sælger vi billigt eller dyrt grej” ikke flytter sig med fordelingen. Uden shelters, som ellers ville fylde hele øverste trin.">
          <Bjaelker enhed="klik" poster={data.prisfordeling.map((t) => ({
            navn: Number.isFinite(t.til) ? `${tal(t.fra)}–${tal(t.til)} kr.` : `over ${tal(t.fra)} kr.`,
            vaerdi: t.antal,
          }))} />
        </Panel>
        <Panel titel="Hvornår klikkes der"
          note="Klik på grej, ugedag × klokketime i dansk tid, hele graf-vinduet. Peg på en celle for tallet.">
          <Varmekort grid={data.varmekort} />
        </Panel>
      </div>

      {/* ---- Grejblokken ---- */}
      <Panel titel="Grejblokken på shelter-siderne"
        note={harEvents
          ? `Shelter-siderne er sitets største trafikkilde, men tjener næsten intet. Blokken er målt siden ${data.daekning.foersteEvent?.slice(0, 10)} — grafen er tom før det, og det er ikke et fald.`
          : "Ingen interne events i vinduet endnu."}>
        <div className="grid gap-4 lg:grid-cols-[1fr,240px]">
          <Soejlegraf data={grejSerie} linje={data.glidende.grejVisninger}
            linjeNavn="7-dages gns. (visninger)" farve={SERIE_FARVER[2]} enhed=" visninger" />
          <dl className="space-y-2 self-start text-sm">
            {([
              ["Visninger af blokken", sum((d) => d.grejVisninger)],
              ["Klik på et forslag", sum((d) => d.grejKlik)],
              ["Guide-visninger", sum((d) => d.guideVisninger)],
              ["Booking-klik", sum((d) => d.bookingKlik)],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-primary/[0.07] pb-1.5">
                <dt className="text-primary/85">{k}</dt>
                <dd className="font-medium tabular-nums text-primary">{tal(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      {/* ---- Produkter ---- */}
      <Panel titel="Mest klikkede grej" note="Top 25 i graf-vinduet. Shelters og byggesæt står i deres eget panel.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">De 25 mest klikkede varer i perioden.</caption>
            <thead>
              <tr className="border-b border-primary/15">
                <th scope="col" className={TH}>Vare</th>
                <th scope="col" className={TH}>Forhandler</th>
                <th scope="col" className={TH}>Kategori</th>
                <th scope="col" className={`${TH} text-right`}>Pris</th>
                <th scope="col" className={`${TH} text-right`}>Klik</th>
              </tr>
            </thead>
            <tbody>
              {data.produkter.map((v) => (
                <tr key={v.navn} className="border-b border-primary/[0.07] hover:bg-primary/[0.02]">
                  <th scope="row" className="max-w-[22rem] truncate py-1.5 pr-3 text-left font-normal text-primary"
                    title={v.navn}>{v.navn}</th>
                  <td className="py-1.5 pr-3 text-primary/80">{v.forhandler ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-primary/80">{v.kategori ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/80">
                    {v.pris != null ? kr(v.pris) : "–"}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{v.klik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- Shelters & byggesæt ---- */}
      <Panel titel="Shelters og byggesæt"
        note={`En anden forretning end grej: få klik, men den billigste vare koster mere end
          den dyreste sovepose. Holdes ude af alle tal ovenfor, så de kan læses.`}>
        {sh.klik === 0 ? (
          <p className="text-sm text-primary/80">Ingen klik i perioden.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[260px,1fr]">
            <dl className="space-y-2.5 self-start text-sm">
              {([
                [`Klik · ${p} dage`, tal(sh.klik), <Retning key="r" nu={sh.klik} foer={sh.klikForrige} />],
                [`Klikket værdi · ${p} dage`, kr(sh.vaerdi), null],
                ["Median varepris", sh.medianPris != null ? kr(sh.medianPris) : "–", null],
              ] as const).map(([k, v, extra]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-primary/[0.07] pb-1.5">
                  <dt className="text-primary/85">{k}</dt>
                  <dd className="flex items-center gap-2 font-medium tabular-nums text-primary">
                    {v}{extra}
                  </dd>
                </div>
              ))}
              <div className="pt-0.5 text-xs text-primary/80">
                Forhandlere i graf-vinduet:{" "}
                {data.shelters.forhandlere.map((f) => `${f.navn} (${f.klik})`).join(", ") || "–"}
              </div>
            </dl>
            <div className="overflow-x-auto">
              <p className="mb-1.5 text-xs text-primary/80">
                Varer i hele graf-vinduet ({data.vindue.dage} dage) — nøgletallene til
                venstre er {p} dage.
              </p>
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Klikkede shelters og byggesæt i de seneste {data.vindue.dage} dage.
                </caption>
                <thead>
                  <tr className="border-b border-primary/15">
                    <th scope="col" className={TH}>Vare</th>
                    <th scope="col" className={TH}>Forhandler</th>
                    <th scope="col" className={`${TH} text-right`}>Pris</th>
                    <th scope="col" className={`${TH} text-right`}>Klik</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shelters.produkter.map((v) => (
                    <tr key={v.navn} className="border-b border-primary/[0.07]">
                      <th scope="row" className="max-w-[20rem] truncate py-1.5 pr-3 text-left font-normal text-primary"
                        title={v.navn}>{v.navn}</th>
                      <td className="py-1.5 pr-3 text-primary/80">{v.forhandler ?? "–"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-primary/80">
                        {v.pris != null ? kr(v.pris) : "–"}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{v.klik}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {/* ---- Sundhed ---- */}
      <Panel titel="Guidernes tilstand"
        note="Samme vurdering som vagtjobbet mailer om hver morgen — ét sted at se, om der er noget at rette.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {([
            ["Guider", tal(data.sundhed.guider), false],
            ["Med problemer", tal(data.sundhed.medProblemer), data.sundhed.medProblemer > 0],
            ["Døde pladser", `${tal(data.sundhed.doedePladser)} / ${tal(data.sundhed.pladser)}`, false],
            ["Over 60 % én forhandler", tal(data.sundhed.koncentration), false],
            ["Ville dø uden største", tal(data.sundhed.enForhandler), data.sundhed.enForhandler > 0],
          ] as const).map(([k, v, advarsel]) => (
            <div key={k} className={`rounded-lg p-2.5 ${
              advarsel ? "bg-[#A8744F]/[0.08]" : "bg-primary/[0.04]"}`}>
              <div className="text-xs leading-snug text-primary/85">{k}</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-primary">{v}</div>
            </div>
          ))}
        </div>
        {data.sundhed.problemer.length > 0 ? (
          <ul className="mt-3.5 space-y-1.5 text-sm">
            {data.sundhed.problemer.map((h) => (
              <li key={h.slug}>
                <a href={`/bedste/${h.slug}`} target="_blank" rel="noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:text-accent-dark hover:underline">
                  {h.slug}
                </a>
                <span className="text-primary/80"> — {h.problems.join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3.5 flex items-center gap-1.5 text-sm text-pine">
            <span aria-hidden>✓</span> Ingen problemer i nogen guide.
          </p>
        )}
      </Panel>

      {/* ---- Datagrundlag ---- */}
      <Panel titel="Datagrundlag"
        note="Grænserne hører med til tallene: en graf over 90 dage er tom før første måling, og det ser ellers ud som et fald.">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {([
            ["Første affiliate-klik", data.daekning.foersteKlik?.slice(0, 10) ?? "–"],
            ["Første interne event", data.daekning.foersteEvent?.slice(0, 10) ?? "–"],
            ["Klik-rækker hentet", tal(data.daekning.klikRaekker)],
            ["Event-rækker hentet", tal(data.daekning.eventRaekker)],
          ] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-primary/80">{k}</dt>
              <dd className="tabular-nums text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
