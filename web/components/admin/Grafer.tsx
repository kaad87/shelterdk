"use client";

/**
 * Grafer til admin-dashboardet, tegnet som inline SVG.
 *
 * Uden et chart-bibliotek, med vilje. next.config har en stram CSP, og
 * Recharts/Chart.js ville koste både en allowlistet third-party-bundle og
 * ~90 kB klient-JS på en side tre personer ser. SVG'erne her er rene
 * funktioner af deres props, kan serverrenderes, og kan læses i en diff.
 *
 * Kontrast: et dashboard er en læseflade med små tal, så alt der bærer
 * information holder sig over WCAG AA (4,5:1). Sitets øvrige sider bruger
 * lysere grå til hjælpetekst, men her er hjælpeteksten selve indholdet.
 * Målt: fill-opacity 0.6 på skifer giver 3,47:1 og falder igennem.
 */

import { useEffect, useRef, useState } from "react";

const GULD = "#C5A059";
const SKIFER = "#2C3E50";
const GRAN = "#4A6B4A";
/** Faste farver pr. serie, så en forhandler har samme farve i alle grafer. */
export const SERIE_FARVER = [GULD, SKIFER, GRAN, "#8A6A26", "#6B7280", "#A8744F", "#7C9CB0"];

/** Mindste opacity på skifer der klarer AA mod hvid. Under den bliver tal gætteri. */
const TEKST = 0.72;
/** Gitterlinjer skal kunne anes, ikke læses — de bærer ingen information selv. */
const GITTER = 0.09;

/**
 * Vælger akse-mærker man kan læse uden at regne.
 *
 * Det nytter ikke kun at runde TOPPEN op: 25 klik blev til loftet 25, hvis
 * halvdel er 12,5 og vises som 13. Derfor vælges først et pænt TRIN, og
 * toppen følger af trinnet — så er hvert mærke et rundt tal.
 *
 * Trinnet er mindst 1, fordi begge akser tæller hele ting (klik og kroner);
 * ellers fik en graf med maksimum 1 mærkerne 0 / 0,25 / 0,5 / 0,75 / 1.
 */
function akseMaerker(maks: number): { top: number; maerker: number[] } {
  if (!(maks > 0)) return { top: 1, maerker: [0, 1] };
  const grov = maks / 4;
  const tiere = 10 ** Math.floor(Math.log10(grov));
  const trin = Math.max(
    1, [1, 2, 2.5, 5, 10].map((x) => x * tiere).find((x) => x >= grov) ?? 10 * tiere);
  const top = Math.ceil(maks / trin) * trin;
  const maerker: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += trin) maerker.push(v);
  return { top, maerker };
}

function pænTal(n: number): string {
  return n.toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

/** Kort datomærke: "4/10". Fulde datoer fylder x-aksen op på 90 dage. */
function kortDato(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** Lang dato til tooltip: "lørdag 11. oktober". */
function langDato(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("da-DK",
    { weekday: "long", day: "numeric", month: "long" });
}

/** Bredde en graf tegnes i, når den ikke kan måles (serverrender og tests). */
const STANDARD_BREDDE = 740;
/** Under den bredde scroller grafen i stedet for at skrumpe. */
const MINDSTE_BREDDE = 560;

/**
 * Graf-ramme der giver grafen dens viewBox i FAKTISKE pixels.
 *
 * Et fast viewBox i en container med `w-full` betyder, at skriftstørrelsen
 * følger containerens bredde. Målt på dashboardet: de fuldbrede grafer
 * tegnede akse-teksten med 16,3 px og de halvbrede med 7,7 px — samme kode,
 * dobbelt så stor skrift det ene sted og ulæselig det andet. En
 * minimumsbredde alene løser kun den lille ende.
 *
 * Derfor måles containeren, og viewBox sættes til det målte tal. Så er
 * skalaen altid 1:1, og 10 px er 10 px uanset hvor grafen står. Under
 * MINDSTE_BREDDE scroller rammen vandret i stedet, så en telefon ikke
 * presser 90 dage ned i 343 px.
 *
 * Uden ResizeObserver (serverrender, jsdom) bruges standardbredden, og
 * grafen ser ud som før.
 */
function Ramme({ children }: { children: (bredde: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maalt, setMaalt] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setMaalt(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bredde = Math.max(MINDSTE_BREDDE, maalt || STANDARD_BREDDE);
  return (
    <div ref={ref} className="-mx-1 overflow-x-auto px-1">
      <div style={{ minWidth: MINDSTE_BREDDE }}>{children(bredde)}</div>
    </div>
  );
}

interface SoejleProps {
  data: { dato: string; vaerdi: number }[];
  /** Linje oven på søjlerne, typisk et glidende gennemsnit. */
  linje?: number[];
  linjeNavn?: string;
  hoejde?: number;
  farve?: string;
  /** Sættes efter værdien i tooltip, fx " kr." */
  enhed?: string;
}

/**
 * Søjler pr. dag med en valgfri glidende linje.
 *
 * Med 1-8 klik om dagen er de enkelte søjler for støjende til at vise en
 * udvikling; linjen er det man faktisk læser, og søjlerne giver kun det
 * underliggende niveau.
 *
 * Hver søjle har en usynlig, fuldhøj ramme med et <title>, så man kan pege
 * på en hvilken som helst dag — også en dag uden klik, hvor søjlen er 0 px
 * høj og ellers umulig at ramme.
 */
export function Soejlegraf({
  data, linje, linjeNavn = "7-dages gennemsnit", hoejde = 180, farve = GULD, enhed = "",
}: SoejleProps) {
  if (data.length === 0) return <IngenData hoejde={hoejde} />;
  const H = hoejde, PAD_B = 24, PAD_V = 38;
  const { top: maks, maerker } = akseMaerker(
    Math.max(1, ...data.map((d) => d.vaerdi), ...(linje ?? [])));
  const trin = Math.max(1, Math.ceil(data.length / 8));
  const sidste = data[data.length - 1];

  return (
    <Ramme>{(B) => {
      const bredde = (B - PAD_V) / data.length;
      const y = (v: number) => H - PAD_B - (v / maks) * (H - PAD_B - 14);
      const linjePunkter = linje?.map((v, i) => `${PAD_V + bredde * (i + 0.5)},${y(v)}`).join(" ");
      return (
      <svg viewBox={`0 0 ${B} ${H}`} className="w-full" role="img"
        aria-label={`Udvikling pr. dag fra ${data[0].dato} til ${sidste.dato}. `
          + `Højeste dag: ${pænTal(maks)}${enhed}. Seneste dag: ${pænTal(sidste.vaerdi)}${enhed}.`}>
        {maerker.map((v) => (
          <g key={v}>
            <line x1={PAD_V} x2={B} y1={y(v)} y2={y(v)}
              stroke={SKIFER} strokeOpacity={v === 0 ? 0.22 : GITTER} strokeWidth={1} />
            <text x={PAD_V - 6} y={y(v) + 3.5} textAnchor="end"
              fontSize={10} fill={SKIFER} fillOpacity={TEKST}>
              {pænTal(v)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect key={d.dato} x={PAD_V + bredde * i + bredde * 0.15}
            y={y(d.vaerdi)} width={Math.max(1, bredde * 0.7)}
            height={Math.max(0, H - PAD_B - y(d.vaerdi))}
            fill={farve} fillOpacity={0.5} />
        ))}
        {linjePunkter && (
          <polyline points={linjePunkter} fill="none" stroke={SKIFER}
            strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Usynlige rammer til tooltip — lagt sidst, så de ligger øverst. */}
        {data.map((d, i) => (
          <rect key={`t${d.dato}`} x={PAD_V + bredde * i} y={0}
            width={Math.max(1, bredde)} height={H - PAD_B} fill="transparent">
            <title>{`${langDato(d.dato)}: ${pænTal(d.vaerdi)}${enhed || " "}`}</title>
          </rect>
        ))}
        {data.map((d, i) => (i % trin === 0 ? (
          <text key={`x${d.dato}`} x={PAD_V + bredde * (i + 0.5)} y={H - 8}
            textAnchor="middle" fontSize={10} fill={SKIFER} fillOpacity={TEKST}>
            {kortDato(d.dato)}
          </text>
        ) : null))}
        {linje && (
          <g>
            <line x1={B - 118} x2={B - 104} y1={8} y2={8} stroke={SKIFER} strokeWidth={1.8} />
            <text x={B - 100} y={11.5} fontSize={10} fill={SKIFER} fillOpacity={TEKST}>
              {linjeNavn}
            </text>
          </g>
        )}
      </svg>
      );
    }}</Ramme>
  );
}

/**
 * Stablet areal: hvordan fordelingen mellem serier flytter sig over tid.
 *
 * Vises i absolutte tal og ikke i procent. Et areal der fylder mindre, fordi
 * de andre voksede, ser i en procentgraf ud som et fald — og det er præcis
 * den fejlslutning, en forhandler-mix-graf skal undgå.
 */
export function StabletAreal({
  datoer, serier, hoejde = 180,
}: {
  datoer: string[];
  serier: { navn: string; vaerdier: number[] }[];
  hoejde?: number;
}) {
  if (datoer.length === 0 || serier.length === 0) return <IngenData hoejde={hoejde} />;
  const H = hoejde, PAD_B = 24, PAD_V = 38;
  const totaler = datoer.map((_, i) => serier.reduce((s, r) => s + (r.vaerdier[i] ?? 0), 0));
  const { top: maks, maerker } = akseMaerker(Math.max(1, ...totaler));
  const y = (v: number) => H - PAD_B - (v / maks) * (H - PAD_B - 14);
  const trin = Math.max(1, Math.ceil(datoer.length / 8));

  return (
    <div>
      <Ramme>{(B) => {
        const x = (i: number) => PAD_V + ((B - PAD_V) * i) / Math.max(1, datoer.length - 1);
        let bund = datoer.map(() => 0);
        const flader = serier.map((s, si) => {
          const top = bund.map((b, i) => b + (s.vaerdier[i] ?? 0));
          const sti = [
            ...top.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`),
            ...[...bund].reverse().map((v, i) => `L${x(datoer.length - 1 - i)},${y(v)}`),
            "Z",
          ].join(" ");
          bund = top;
          return { sti, farve: SERIE_FARVER[si % SERIE_FARVER.length], navn: s.navn };
        });
        const bredde = (B - PAD_V) / Math.max(1, datoer.length);
        return (
        <svg viewBox={`0 0 ${B} ${H}`} className="w-full" role="img"
          aria-label={`Fordeling over tid mellem ${serier.map((s) => s.navn).join(", ")}.`}>
          {maerker.map((v) => (
            <g key={v}>
              <line x1={PAD_V} x2={B} y1={y(v)} y2={y(v)}
                stroke={SKIFER} strokeOpacity={v === 0 ? 0.22 : GITTER} />
              <text x={PAD_V - 6} y={y(v) + 3.5} textAnchor="end"
                fontSize={10} fill={SKIFER} fillOpacity={TEKST}>{pænTal(v)}</text>
            </g>
          ))}
          {flader.map((f) => (
            <path key={f.navn} d={f.sti} fill={f.farve} fillOpacity={0.6} />
          ))}
          {datoer.map((d, i) => (
            <rect key={`t${d}`} x={x(i) - bredde / 2} y={0}
              width={Math.max(1, bredde)} height={H - PAD_B} fill="transparent">
              <title>
                {`${langDato(d)} — ` +
                  serier.map((s) => `${s.navn}: ${pænTal(s.vaerdier[i] ?? 0)}`).join(", ")}
              </title>
            </rect>
          ))}
          {datoer.map((d, i) => (i % trin === 0 ? (
            <text key={d} x={x(i)} y={H - 8} textAnchor="middle"
              fontSize={10} fill={SKIFER} fillOpacity={TEKST}>{kortDato(d)}</text>
          ) : null))}
        </svg>
        );
      }}</Ramme>
      <Signatur poster={serier.map((s, i) => ({
        navn: s.navn, farve: SERIE_FARVER[i % SERIE_FARVER.length],
      }))} />
    </div>
  );
}

export function Signatur({ poster }: { poster: { navn: string; farve: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary/80">
      {poster.map((p) => (
        <li key={p.navn} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: p.farve, opacity: 0.8 }} />
          {p.navn}
        </li>
      ))}
    </ul>
  );
}

/** Lille kurve uden akser, til en tabelcelle. */
export function Sparkline({ tal, bredde = 72, hoejde = 20, titel }: {
  tal: number[]; bredde?: number; hoejde?: number; titel?: string;
}) {
  // For få punkter til en kurve. Stregen er dekorativ — tallene står i
  // cellerne ved siden af — men den skal stadig kunne ses.
  if (tal.length < 2) return <span aria-hidden className="text-primary/70">–</span>;
  const maks = Math.max(1, ...tal);
  const punkter = tal
    .map((v, i) => `${(bredde * i) / (tal.length - 1)},${hoejde - 1 - (v / maks) * (hoejde - 2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${bredde} ${hoejde}`} width={bredde} height={hoejde}
      role="img" aria-label={titel ?? `Udvikling, højeste dag ${maks}`}>
      <title>{titel ?? `Højeste dag: ${maks}`}</title>
      <polyline points={punkter} fill="none" stroke={GULD} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Vandrette bjælker til en fordeling, fx pr. placering eller kategori. */
export function Bjaelker({ poster, enhed = "klik" }: {
  poster: { navn: string; vaerdi: number; note?: string }[]; enhed?: string;
}) {
  if (poster.length === 0) return <p className="text-sm text-primary/70">Ingen data i perioden.</p>;
  const maks = Math.max(...poster.map((p) => p.vaerdi), 1);
  return (
    <ul className="space-y-2">
      {poster.map((p) => (
        <li key={p.navn} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-primary" title={p.navn}>{p.navn}</span>
            <span className="shrink-0 tabular-nums text-primary/80">
              {pænTal(p.vaerdi)} {enhed}{p.note ? <span className="text-primary/70"> · {p.note}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-primary/[0.07]">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(p.vaerdi / maks) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const UGEDAGE = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Varmekort ugedag × time. Viser hvornår på ugen folk klikker videre. */
export function Varmekort({ grid }: { grid: number[][] }) {
  const maks = Math.max(1, ...grid.flat());
  const CELLE = 27, RÆKKE = 20, VENSTRE = 34;
  // Varmekortet har faste celler og skal ikke måles: 24 timer × 27 px er
  // altid 682 px, og rammen sørger for scroll på en smal skærm.
  return (
    <Ramme>
      {() => (
      <svg viewBox={`0 0 ${VENSTRE + CELLE * 24} ${RÆKKE * 7 + 18}`} className="w-full"
        role="img" aria-label={`Klik pr. ugedag og klokketime. Travleste celle: ${maks} klik.`}>
        {grid.map((række, d) => (
          <g key={d}>
            <text x={VENSTRE - 5} y={d * RÆKKE + 14} textAnchor="end"
              fontSize={10} fill={SKIFER} fillOpacity={TEKST}>{UGEDAGE[d]}</text>
            {række.map((v, t) => (
              <rect key={t} x={VENSTRE + t * CELLE} y={d * RÆKKE + 2}
                width={CELLE - 2.5} height={RÆKKE - 3.5} rx={2.5}
                fill={v > 0 ? GULD : SKIFER}
                fillOpacity={v > 0 ? 0.2 + 0.75 * (v / maks) : 0.045}>
                <title>{`${UGEDAGE[d]} kl. ${t}–${t + 1}: ${v} klik`}</title>
              </rect>
            ))}
          </g>
        ))}
        {[0, 6, 12, 18, 23].map((t) => (
          <text key={t} x={VENSTRE + t * CELLE + (CELLE - 2.5) / 2} y={RÆKKE * 7 + 13}
            textAnchor="middle" fontSize={10} fill={SKIFER} fillOpacity={TEKST}>{t}</text>
        ))}
      </svg>
      )}
    </Ramme>
  );
}

function IngenData({ hoejde }: { hoejde: number }) {
  return (
    <div style={{ height: hoejde }}
      className="flex items-center justify-center rounded-lg border border-dashed border-primary/15 text-sm text-primary/70">
      Ingen data i perioden
    </div>
  );
}

/**
 * Retningschip. Grøn op er ikke altid godt, så chippen siger kun retningen —
 * fortolkningen står i overskriften ved siden af.
 */
export function Retning({ nu, foer, enhed = "" }: { nu: number; foer: number; enhed?: string }) {
  const base = "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums";
  if (foer === 0 && nu === 0) {
    return <span className={`${base} bg-primary/[0.06] text-primary/80`}>uændret</span>;
  }
  if (foer === 0) {
    return <span className={`${base} bg-pine/10 text-pine`}>ny aktivitet</span>;
  }
  const pct = ((nu - foer) / foer) * 100;
  const op = pct >= 0;
  return (
    <span className={`${base} ${op ? "bg-pine/10 text-pine" : "bg-[#A8744F]/10 text-[#8A4B22]"}`}>
      <span aria-hidden>{op ? "▲" : "▼"}</span>
      <span className="sr-only">{op ? "op" : "ned"} </span>
      {Math.abs(pct).toLocaleString("da-DK", { maximumFractionDigits: 0 })} %{enhed}
    </span>
  );
}
