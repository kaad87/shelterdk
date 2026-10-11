"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Soejlegraf, StabletAreal, Sparkline, Bjaelker, Varmekort, Retning, Signatur, SERIE_FARVER,
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
    medianPris: number | null; guiderMedKlik: number; andelFraGuider: number;
    grejVisninger: number; grejKlik: number; grejRate: number | null;
  };
  serie: Dag[];
  glidende: { klik: number[]; vaerdi: number[]; grejVisninger: number[] };
  guider: Bucket[]; forhandlere: Bucket[]; placeringer: Bucket[];
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

function Kort({ titel, vaerdi, under, hjaelp }: {
  titel: string; vaerdi: string; under?: React.ReactNode; hjaelp?: string;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white p-3.5">
      <div className="text-xs font-medium uppercase tracking-wide text-primary/50"
        title={hjaelp}>{titel}</div>
      <div className="mt-1 font-serif text-2xl font-bold tabular-nums text-primary">{vaerdi}</div>
      {under && <div className="mt-0.5 text-xs">{under}</div>}
    </div>
  );
}

function Panel({ titel, note, children }: {
  titel: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-primary/10 bg-white p-4">
      <h2 className="font-serif text-base font-bold text-primary">{titel}</h2>
      {note && <p className="mt-0.5 text-xs text-primary/55">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function AdminAffiliatePerformance() {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  const [henter, setHenter] = useState(false);
  const [dage, setDage] = useState(90);
  const [periode, setPeriode] = useState(28);

  const hent = useCallback(async () => {
    if (!secret) return;
    setHenter(true);
    setFejl(null);
    try {
      const r = await fetch(`/api/admin/affiliate-performance?dage=${dage}&periode=${periode}`, {
        headers: { "x-admin-secret": secret },
        cache: "no-store",
      });
      if (!r.ok) {
        setFejl(r.status === 401 ? "Forkert admin secret." : `Fejl ${r.status}: ${(await r.json()).error ?? ""}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setFejl(e instanceof Error ? e.message : "Kunne ikke hente data.");
    } finally {
      setHenter(false);
    }
  }, [secret, dage, periode]);

  useEffect(() => {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (s) setSecret(s);
  }, []);
  useEffect(() => { void hent(); }, [hent]);

  // Dashboardet skal vise udviklingen "løbende", så det henter sig selv igen
  // hver 5. minut. Intervallet ryddes op ved unmount; ellers bliver der et
  // nyt timer-kald hver gang vinduet eller perioden ændres.
  useEffect(() => {
    if (!secret) return;
    const t = setInterval(() => { void hent(); }, 5 * 60_000);
    return () => clearInterval(t);
  }, [secret, hent]);

  if (!secret) {
    return (
      <div className="max-w-sm">
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Admin secret"
          className="w-full rounded-lg border border-primary/15 px-3 py-2" />
        <button
          onClick={() => { sessionStorage.setItem(STORAGE_KEY, input); setSecret(input); }}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
          Log ind
        </button>
      </div>
    );
  }

  if (fejl) {
    return (
      <div className="rounded-xl border border-[#A8744F]/30 bg-[#A8744F]/5 p-4 text-sm text-primary">
        <p className="font-medium">{fejl}</p>
        <button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setSecret(""); setFejl(null); }}
          className="mt-2 text-xs underline">Skift secret</button>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-primary/50">Henter…</p>;

  const n = data.noegletal;
  const p = data.vindue.periode;
  const grejSerie = data.serie.map((d) => ({ dato: d.dato, vaerdi: d.grejVisninger }));
  const harEvents = data.daekning.eventRaekker > 0;

  return (
    <div className="space-y-5">
      {/* ---- Styring ---- */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-primary/60">Graf-vindue</span>
          <select value={dage} onChange={(e) => setDage(Number(e.target.value))}
            className="rounded-lg border border-primary/15 px-2 py-1">
            {[14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} dage</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-primary/60">Nøgletals-periode</span>
          <select value={periode} onChange={(e) => setPeriode(Number(e.target.value))}
            className="rounded-lg border border-primary/15 px-2 py-1">
            {[7, 14, 28, 90].map((d) => <option key={d} value={d}>{d} dage</option>)}
          </select>
        </label>
        <button onClick={() => void hent()} disabled={henter}
          className="rounded-lg border border-primary/15 px-3 py-1 hover:bg-primary/5 disabled:opacity-50">
          {henter ? "Henter…" : "Opdater"}
        </button>
        <span className="text-xs text-primary/45">
          opdateret {new Date(data.genereret).toLocaleTimeString("da-DK",
            { hour: "2-digit", minute: "2-digit" })} · fornyer sig selv hvert 5. minut
        </span>
      </div>

      {/* ---- Nøgletal ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kort titel={`Klik (${p} d)`} vaerdi={tal(n.klik)}
          under={<Retning nu={n.klik} foer={n.klikForrige} />}
          hjaelp="Affiliate-klik videre til en forhandler" />
        <Kort titel={`Klikket værdi (${p} d)`} vaerdi={kr(n.vaerdi)}
          under={<Retning nu={n.vaerdi} foer={n.vaerdiForrige} />}
          hjaelp="Summen af listepriserne på de varer der blev klikket på — ikke omsætning" />
        <Kort titel="Median varepris" vaerdi={n.medianPris != null ? kr(n.medianPris) : "–"} />
        <Kort titel="Guider med klik" vaerdi={tal(n.guiderMedKlik)}
          under={<span className="text-primary/55">{pct(n.andelFraGuider)} af klik fra /bedste</span>} />
        <Kort titel="Grejblok-rate" vaerdi={n.grejRate != null ? pct(n.grejRate) : "–"}
          under={<span className="text-primary/55">
            {tal(n.grejKlik)} af {tal(n.grejVisninger)} visninger</span>}
          hjaelp="Klik på et grej-forslag på en shelter-side, delt med antal gange blokken blev set" />
        <Kort titel="Købbare varer" vaerdi={data.katalog.koebbare != null ? tal(data.katalog.koebbare) : "–"}
          under={<span className="text-primary/55">af {tal(data.katalog.ialt ?? 0)} i feedet</span>} />
      </div>

      {/* ---- Udvikling ---- */}
      <Panel titel="Affiliate-klik pr. dag"
        note={`${data.vindue.fra} – ${data.vindue.til}. Søjler er den enkelte dag, linjen er 7-dages gennemsnit.`}>
        <Soejlegraf data={data.serie.map((d) => ({ dato: d.dato, vaerdi: d.klik }))}
          linje={data.glidende.klik} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titel="Klikket værdi pr. dag"
          note="Listepris på de klikkede varer. Et mål for købsintention, ikke for omsætning.">
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
        note={`Klik i hele graf-vinduet (${data.vindue.dage} dage). "Retning" sammenligner de seneste 7 dage med de 7 før dem.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-left text-xs uppercase tracking-wide text-primary/50">
                <th className="py-1.5 pr-3 font-medium">Guide</th>
                <th className="py-1.5 pr-3 text-right font-medium">Klik</th>
                <th className="py-1.5 pr-3 text-right font-medium">Andel</th>
                <th className="py-1.5 pr-3 text-right font-medium">Værdi</th>
                <th className="py-1.5 pr-3 text-right font-medium">7 d</th>
                <th className="py-1.5 pr-3 font-medium">Retning</th>
                <th className="py-1.5 font-medium">Udvikling</th>
              </tr>
            </thead>
            <tbody>
              {data.guider.map((b) => (
                <tr key={b.navn} className="border-b border-primary/5">
                  <td className="py-1.5 pr-3">
                    {b.navn === "(ingen)" ? (
                      <span className="text-primary/55">uden for /bedste</span>
                    ) : (
                      <a href={`/bedste/${b.navn}`} target="_blank" rel="noreferrer"
                        className="text-primary hover:text-accent-dark hover:underline">{b.navn}</a>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{tal(b.klik)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/60">{pct(b.andel)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/60">{kr(b.vaerdi)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{tal(b.nu7)}</td>
                  <td className="py-1.5 pr-3 text-xs"><Retning nu={b.nu7} foer={b.foer7} /></td>
                  <td className="py-1.5"><Sparkline tal={b.serie} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- Fordelinger ---- */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Panel titel="Placering på siden"
          note="Hvor på guiden knappen blev trykket.">
          <Bjaelker poster={data.placeringer.map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
        <Panel titel="Forhandler">
          <Bjaelker poster={data.forhandlere.map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
        <Panel titel="Kategori">
          <Bjaelker poster={data.kategorier.slice(0, 12).map((b) => ({
            navn: b.navn, vaerdi: b.klik, note: pct(b.andel) }))} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel titel="Prisfordeling på klikkede varer"
          note="Faste trin, så svaret på “sælger vi billigt eller dyrt grej” ikke flytter sig med fordelingen.">
          <Bjaelker enhed="klik" poster={data.prisfordeling.map((t) => ({
            navn: t.til === null || !Number.isFinite(t.til)
              ? `over ${tal(t.fra)} kr.` : `${tal(t.fra)}–${tal(t.til)} kr.`,
            vaerdi: t.antal,
          }))} />
        </Panel>
        <Panel titel="Hvornår klikkes der"
          note="Ugedag × klokketime, dansk tid, hele graf-vinduet.">
          <Varmekort grid={data.varmekort} />
        </Panel>
      </div>

      {/* ---- Grejblokken ---- */}
      <Panel titel="Grejblokken på shelter-siderne"
        note={harEvents
          ? `Shelter-siderne er sitets største trafikkilde men tjener næsten intet. Blokken måles siden ${data.daekning.foersteEvent?.slice(0, 10)}.`
          : "Ingen interne events i vinduet endnu."}>
        <div className="grid gap-4 md:grid-cols-[1fr,220px]">
          <Soejlegraf data={grejSerie} linje={data.glidende.grejVisninger}
            linjeNavn="7-dages gennemsnit (visninger)" farve={SERIE_FARVER[2]} />
          <dl className="space-y-2 text-sm">
            {[
              ["Visninger", tal(data.serie.reduce((s, d) => s + d.grejVisninger, 0))],
              ["Klik på forslag", tal(data.serie.reduce((s, d) => s + d.grejKlik, 0))],
              ["Guide-visninger", tal(data.serie.reduce((s, d) => s + d.guideVisninger, 0))],
              ["Booking-klik", tal(data.serie.reduce((s, d) => s + d.bookingKlik, 0))],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-primary/5 pb-1">
                <dt className="text-primary/60">{k}</dt>
                <dd className="tabular-nums font-medium text-primary">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      {/* ---- Produkter ---- */}
      <Panel titel="Mest klikkede varer" note={`Top 25 i graf-vinduet.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-left text-xs uppercase tracking-wide text-primary/50">
                <th className="py-1.5 pr-3 font-medium">Vare</th>
                <th className="py-1.5 pr-3 font-medium">Forhandler</th>
                <th className="py-1.5 pr-3 font-medium">Kategori</th>
                <th className="py-1.5 pr-3 text-right font-medium">Pris</th>
                <th className="py-1.5 text-right font-medium">Klik</th>
              </tr>
            </thead>
            <tbody>
              {data.produkter.map((v) => (
                <tr key={v.navn} className="border-b border-primary/5">
                  <td className="py-1.5 pr-3 max-w-[22rem] truncate" title={v.navn}>{v.navn}</td>
                  <td className="py-1.5 pr-3 text-primary/60">{v.forhandler ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-primary/60">{v.kategori ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-primary/60">
                    {v.pris != null ? kr(v.pris) : "–"}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{v.klik}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---- Sundhed ---- */}
      <Panel titel="Guidernes tilstand"
        note="Samme vurdering som vagtjobbet mailer om hver morgen — ét sted at se, om der er noget at rette.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Guider", tal(data.sundhed.guider)],
            ["Med problemer", tal(data.sundhed.medProblemer)],
            ["Døde pladser", `${tal(data.sundhed.doedePladser)} / ${tal(data.sundhed.pladser)}`],
            ["Over 60 % én forhandler", tal(data.sundhed.koncentration)],
            ["Ville dø uden største", tal(data.sundhed.enForhandler)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-primary/[0.03] p-2.5">
              <div className="text-xs text-primary/55">{k}</div>
              <div className="mt-0.5 tabular-nums text-lg font-bold text-primary">{v}</div>
            </div>
          ))}
        </div>
        {data.sundhed.problemer.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.sundhed.problemer.map((h) => (
              <li key={h.slug}>
                <a href={`/bedste/${h.slug}`} target="_blank" rel="noreferrer"
                  className="font-medium text-primary hover:text-accent-dark hover:underline">{h.slug}</a>
                <span className="text-primary/60"> — {h.problems.join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-pine">Ingen problemer i nogen guide.</p>
        )}
      </Panel>

      {/* ---- Datagrundlag ---- */}
      <Panel titel="Datagrundlag"
        note="Grænserne hører med til tallene: en graf over 90 dage er tom før første måling, og det ser ellers ud som et fald.">
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          {[
            ["Første affiliate-klik", data.daekning.foersteKlik?.slice(0, 10) ?? "–"],
            ["Første interne event", data.daekning.foersteEvent?.slice(0, 10) ?? "–"],
            ["Klik-rækker hentet", tal(data.daekning.klikRaekker)],
            ["Event-rækker hentet", tal(data.daekning.eventRaekker)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-primary/55">{k}</dt>
              <dd className="tabular-nums text-primary">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-primary/50">
          “Klikket værdi” er summen af listepriserne på de varer, der blev klikket på.
          Det er ikke omsætning: kun en del af klikkene bliver køb, og provisionen er
          en procentdel af beløbet. Tallet er brugbart som retning, ikke som indtægt.
        </p>
      </Panel>
    </div>
  );
}
