/**
 * Grafer til admin-dashboardet, tegnet som inline SVG.
 *
 * Uden et chart-bibliotek, med vilje. next.config har en stram CSP, og
 * Recharts/Chart.js ville koste både en allowlistet third-party-bundle og
 * ~90 kB klient-JS på en side tre personer ser. SVG'erne her er rene
 * funktioner af deres props, kan serverrenderes, og kan læses i en diff.
 *
 * Alle bruger viewBox uden fast bredde, så de skalerer med containeren.
 */

const GULD = "#C5A059";
const SKIFER = "#2C3E50";
const GRAN = "#4A6B4A";
/** Faste farver pr. serie, så en forhandler har samme farve i alle grafer. */
export const SERIE_FARVER = [GULD, SKIFER, GRAN, "#8A6A26", "#6B7280", "#A8744F", "#7C9CB0"];

function pænTal(n: number): string {
  return n.toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

/** Kort datomærke: "4/10". Fulde datoer fylder x-aksen op på 90 dage. */
function kortDato(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

interface SoejleProps {
  data: { dato: string; vaerdi: number }[];
  /** Linje oven på søjlerne, typisk et glidende gennemsnit. */
  linje?: number[];
  linjeNavn?: string;
  hoejde?: number;
  farve?: string;
  enhed?: string;
}

/**
 * Søjler pr. dag med en valgfri glidende linje.
 *
 * Med 1-8 klik om dagen er de enkelte søjler for støjende til at vise en
 * udvikling; linjen er det man faktisk læser, og søjlerne giver kun det
 * underliggende niveau.
 */
export function Soejlegraf({
  data, linje, linjeNavn = "7-dages gennemsnit", hoejde = 170, farve = GULD, enhed = "",
}: SoejleProps) {
  if (data.length === 0) return <IngenData hoejde={hoejde} />;
  const B = 740, H = hoejde, PAD_B = 22, PAD_V = 34;
  const maks = Math.max(1, ...data.map((d) => d.vaerdi), ...(linje ?? []));
  const bredde = (B - PAD_V) / data.length;
  const y = (v: number) => H - PAD_B - (v / maks) * (H - PAD_B - 8);

  // Få mærker på x-aksen; ellers overlapper de ved 90 dage.
  const trin = Math.max(1, Math.ceil(data.length / 8));
  const linjePunkter = linje
    ?.map((v, i) => `${PAD_V + bredde * (i + 0.5)},${y(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="w-full" role="img"
      aria-label={`Udvikling pr. dag. Højeste dag: ${pænTal(maks)}${enhed}.`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD_V} x2={B} y1={y(maks * f)} y2={y(maks * f)}
            stroke={SKIFER} strokeOpacity={f === 0 ? 0.25 : 0.08} strokeWidth={1} />
          <text x={PAD_V - 5} y={y(maks * f) + 3.5} textAnchor="end"
            fontSize={9} fill={SKIFER} fillOpacity={0.5}>
            {pænTal(maks * f)}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <rect key={d.dato} x={PAD_V + bredde * i + bredde * 0.15}
          y={y(d.vaerdi)} width={Math.max(1, bredde * 0.7)}
          height={Math.max(0, H - PAD_B - y(d.vaerdi))}
          fill={farve} fillOpacity={0.45} />
      ))}
      {linjePunkter && (
        <polyline points={linjePunkter} fill="none" stroke={SKIFER}
          strokeWidth={1.8} strokeLinejoin="round" />
      )}
      {data.map((d, i) => (i % trin === 0 ? (
        <text key={`x${d.dato}`} x={PAD_V + bredde * (i + 0.5)} y={H - 7}
          textAnchor="middle" fontSize={9} fill={SKIFER} fillOpacity={0.55}>
          {kortDato(d.dato)}
        </text>
      ) : null))}
      {linje && (
        <text x={B} y={11} textAnchor="end" fontSize={9} fill={SKIFER} fillOpacity={0.6}>
          — {linjeNavn}
        </text>
      )}
    </svg>
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
  datoer, serier, hoejde = 170,
}: {
  datoer: string[];
  serier: { navn: string; vaerdier: number[] }[];
  hoejde?: number;
}) {
  if (datoer.length === 0 || serier.length === 0) return <IngenData hoejde={hoejde} />;
  const B = 740, H = hoejde, PAD_B = 22, PAD_V = 34;
  const totaler = datoer.map((_, i) => serier.reduce((s, r) => s + (r.vaerdier[i] ?? 0), 0));
  const maks = Math.max(1, ...totaler);
  const x = (i: number) => PAD_V + ((B - PAD_V) * i) / Math.max(1, datoer.length - 1);
  const y = (v: number) => H - PAD_B - (v / maks) * (H - PAD_B - 8);
  const trin = Math.max(1, Math.ceil(datoer.length / 8));

  // Kumulativ bund pr. serie, så arealerne stables.
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

  return (
    <div>
      <svg viewBox={`0 0 ${B} ${H}`} className="w-full" role="img"
        aria-label={`Fordeling over tid mellem ${serier.map((s) => s.navn).join(", ")}.`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_V} x2={B} y1={y(maks * f)} y2={y(maks * f)}
              stroke={SKIFER} strokeOpacity={f === 0 ? 0.25 : 0.08} />
            <text x={PAD_V - 5} y={y(maks * f) + 3.5} textAnchor="end"
              fontSize={9} fill={SKIFER} fillOpacity={0.5}>{pænTal(maks * f)}</text>
          </g>
        ))}
        {flader.map((f) => (
          <path key={f.navn} d={f.sti} fill={f.farve} fillOpacity={0.62} />
        ))}
        {datoer.map((d, i) => (i % trin === 0 ? (
          <text key={d} x={x(i)} y={H - 7} textAnchor="middle"
            fontSize={9} fill={SKIFER} fillOpacity={0.55}>{kortDato(d)}</text>
        ) : null))}
      </svg>
      <Signatur poster={serier.map((s, i) => ({
        navn: s.navn, farve: SERIE_FARVER[i % SERIE_FARVER.length],
      }))} />
    </div>
  );
}

export function Signatur({ poster }: { poster: { navn: string; farve: string }[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary/70">
      {poster.map((p) => (
        <li key={p.navn} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: p.farve, opacity: 0.75 }} />
          {p.navn}
        </li>
      ))}
    </ul>
  );
}

/** Lille kurve uden akser, til en tabelcelle. */
export function Sparkline({ tal, bredde = 72, hoejde = 20 }: {
  tal: number[]; bredde?: number; hoejde?: number;
}) {
  if (tal.length < 2) return <span className="text-primary/30">–</span>;
  const maks = Math.max(1, ...tal);
  const punkter = tal
    .map((v, i) => `${(bredde * i) / (tal.length - 1)},${hoejde - 1 - (v / maks) * (hoejde - 2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${bredde} ${hoejde}`} width={bredde} height={hoejde}
      role="img" aria-label={`Udvikling, højeste dag ${maks}`}>
      <polyline points={punkter} fill="none" stroke={GULD} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Vandrette bjælker til en fordeling, fx pr. placering eller kategori. */
export function Bjaelker({ poster, enhed = "klik" }: {
  poster: { navn: string; vaerdi: number; note?: string }[]; enhed?: string;
}) {
  if (poster.length === 0) return <p className="text-sm text-primary/50">Ingen data.</p>;
  const maks = Math.max(...poster.map((p) => p.vaerdi), 1);
  return (
    <ul className="space-y-1.5">
      {poster.map((p) => (
        <li key={p.navn} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-primary/80">{p.navn}</span>
            <span className="shrink-0 tabular-nums text-primary/60">
              {pænTal(p.vaerdi)} {enhed}{p.note ? ` · ${p.note}` : ""}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 w-full rounded-full bg-primary/5">
            <div className="h-1.5 rounded-full bg-accent/70"
              style={{ width: `${(p.vaerdi / maks) * 100}%` }} />
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
  const CELLE = 26, RÆKKE = 18, VENSTRE = 30;
  return (
    <svg viewBox={`0 0 ${VENSTRE + CELLE * 24} ${RÆKKE * 7 + 16}`} className="w-full"
      role="img" aria-label={`Klik pr. ugedag og klokketime. Travleste celle: ${maks} klik.`}>
      {grid.map((række, d) => (
        <g key={d}>
          <text x={VENSTRE - 4} y={d * RÆKKE + 12.5} textAnchor="end"
            fontSize={9} fill={SKIFER} fillOpacity={0.6}>{UGEDAGE[d]}</text>
          {række.map((v, t) => (
            <rect key={t} x={VENSTRE + t * CELLE} y={d * RÆKKE + 2}
              width={CELLE - 2} height={RÆKKE - 3} rx={2}
              fill={v > 0 ? GULD : SKIFER}
              fillOpacity={v > 0 ? 0.15 + 0.75 * (v / maks) : 0.04}>
              <title>{`${UGEDAGE[d]} kl. ${t}: ${v} klik`}</title>
            </rect>
          ))}
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((t) => (
        <text key={t} x={VENSTRE + t * CELLE + (CELLE - 2) / 2} y={RÆKKE * 7 + 11}
          textAnchor="middle" fontSize={9} fill={SKIFER} fillOpacity={0.55}>{t}</text>
      ))}
    </svg>
  );
}

function IngenData({ hoejde }: { hoejde: number }) {
  return (
    <div style={{ height: hoejde }}
      className="flex items-center justify-center rounded-lg bg-primary/[0.03] text-sm text-primary/40">
      Ingen data i perioden
    </div>
  );
}

/** Retningspil med farve. Grøn op er ikke altid godt, så teksten står selv. */
export function Retning({ nu, foer, enhed = "" }: { nu: number; foer: number; enhed?: string }) {
  if (foer === 0 && nu === 0) return <span className="text-primary/40">uændret</span>;
  if (foer === 0) return <span className="text-pine">ny aktivitet</span>;
  const pct = ((nu - foer) / foer) * 100;
  const op = pct >= 0;
  return (
    <span className={op ? "text-pine" : "text-[#A8744F]"}>
      {op ? "▲" : "▼"} {Math.abs(pct).toLocaleString("da-DK", { maximumFractionDigits: 0 })} %{enhed}
    </span>
  );
}
