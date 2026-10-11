/**
 * Aggregering til admin-dashboardet over affiliate-performance.
 *
 * Ligger som et rent modul og ikke i route-handleren, af samme grund som
 * guide-health.ts: tallene skal kunne testes uden en database, og der skal
 * kun findes én definition af hvad "klik de seneste 7 dage" betyder. En
 * dashboard-graf der regner anderledes end tabellen ved siden af er værre
 * end ingen graf.
 *
 * Dage regnes i Europe/Copenhagen og ikke i UTC. Et klik kl. 00:30 dansk tid
 * om sommeren ligger på UTC-dagen før, og en graf hvor dagsgrænsen ligger to
 * timer forskudt kan ikke sammenlignes med noget brugeren selv kan tælle.
 */

export interface KlikRaekke {
  created_at: string;
  path: string | null;
  placement: string | null;
  retailer: string | null;
  category: string | null;
  price_dkk: number | null;
  product_name: string | null;
  brand: string | null;
}

export interface EventRaekke {
  created_at: string;
  event: string;
  path: string | null;
  params: Record<string, unknown> | null;
}

/** YYYY-MM-DD i dansk tid. sv-SE giver ISO-formatet uden at vi selv formaterer. */
export function dkDato(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
}

/** Klokketimen 0-23 i dansk tid. */
export function dkTime(iso: string): number {
  return Number(
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false,
    }).slice(0, 2),
  );
}

/** Ugedag i dansk tid, 0 = mandag (ikke søndag — danske uger starter om mandagen). */
export function dkUgedag(iso: string): number {
  const d = new Date(iso).toLocaleDateString("en-US", {
    timeZone: "Europe/Copenhagen", weekday: "short",
  });
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d);
}

function datoListe(tilDato: Date, dage: number): string[] {
  const ud: string[] = [];
  for (let i = dage - 1; i >= 0; i--) {
    const d = new Date(tilDato.getTime() - i * 86_400_000);
    ud.push(dkDato(d.toISOString()));
  }
  return ud;
}

export interface Dag {
  dato: string;
  klik: number;
  vaerdi: number;
  grejVisninger: number;
  grejKlik: number;
  guideVisninger: number;
  bookingKlik: number;
}

/**
 * Én række pr. dag i vinduet, også for dage uden aktivitet.
 *
 * Huller må ikke springes over: en graf der kun tegner dage med data
 * komprimerer en stille weekend til ingenting og får en flad uge til at se
 * ud som vækst.
 */
export function dagligSerie(
  klik: KlikRaekke[], events: EventRaekke[], nu: Date, dage: number,
): Dag[] {
  const tom = (): Omit<Dag, "dato"> => ({
    klik: 0, vaerdi: 0, grejVisninger: 0, grejKlik: 0, guideVisninger: 0, bookingKlik: 0,
  });
  const kort = new Map<string, Omit<Dag, "dato">>();
  for (const d of datoListe(nu, dage)) kort.set(d, tom());

  for (const k of klik) {
    const b = kort.get(dkDato(k.created_at));
    if (!b) continue;
    b.klik += 1;
    b.vaerdi += k.price_dkk ?? 0;
  }
  for (const b of kort.values()) b.vaerdi = Math.round(b.vaerdi);
  for (const e of events) {
    const b = kort.get(dkDato(e.created_at));
    if (!b) continue;
    if (e.event === "gear_block_seen") b.grejVisninger += 1;
    else if (e.event === "gear_suggestion_click") b.grejKlik += 1;
    else if (e.event === "guide_view") b.guideVisninger += 1;
    else if (e.event === "book_button_clicked") b.bookingKlik += 1;
  }
  return [...kort].map(([dato, v]) => ({ dato, ...v }));
}

/** Glidende gennemsnit, så en graf med få klik pr. dag kan læses. */
export function glidende(tal: number[], vindue: number): number[] {
  return tal.map((_, i) => {
    const fra = Math.max(0, i - vindue + 1);
    const del = tal.slice(fra, i + 1);
    return del.reduce((a, b) => a + b, 0) / del.length;
  });
}

export interface Bucket {
  navn: string;
  klik: number;
  andel: number;
  vaerdi: number;
  /** Klik i de seneste 7 dage, og i de 7 dage før dem — altså retningen. */
  nu7: number;
  foer7: number;
  /** Klik pr. dag i vinduet, til sparkline. */
  serie: number[];
}

/**
 * Grupperer klik efter en nøgle og regner retning med.
 *
 * `null`-nøgler samles under "(ingen)" i stedet for at blive smidt væk: at
 * 30 klik mangler forhandler er i sig selv noget man skal kunne se.
 */
export function grupper(
  klik: KlikRaekke[], nøgle: (k: KlikRaekke) => string | null,
  nu: Date, dage: number,
): Bucket[] {
  const datoer = datoListe(nu, dage);
  const idx = new Map(datoer.map((d, i) => [d, i]));
  const graense7 = new Date(nu.getTime() - 7 * 86_400_000).toISOString();
  const graense14 = new Date(nu.getTime() - 14 * 86_400_000).toISOString();

  // Kun rækker inden for vinduet. Route-handleren henter lidt bredere end
  // grafvinduet, for at retningspilene har to perioder at sammenligne — og
  // uden dette filter talte tabellen de ekstra dage med, mens overskriften
  // lovede "de seneste N dage". Et tal der ikke er det etiketten siger, er
  // værre end et tal der mangler.
  const foerste = datoer[0];
  const m = new Map<string, Bucket>();
  for (const k of klik) {
    if (dkDato(k.created_at) < foerste) continue;
    const navn = nøgle(k) ?? "(ingen)";
    let b = m.get(navn);
    if (!b) {
      b = { navn, klik: 0, andel: 0, vaerdi: 0, nu7: 0, foer7: 0, serie: datoer.map(() => 0) };
      m.set(navn, b);
    }
    b.klik += 1;
    b.vaerdi += k.price_dkk ?? 0;
    if (k.created_at >= graense7) b.nu7 += 1;
    else if (k.created_at >= graense14) b.foer7 += 1;
    const i = idx.get(dkDato(k.created_at));
    if (i !== undefined) b.serie[i] += 1;
  }
  const ialt = [...m.values()].reduce((sum, b) => sum + b.klik, 0) || 1;
  return [...m.values()]
    .map((b) => ({ ...b, andel: b.klik / ialt, vaerdi: Math.round(b.vaerdi) }))
    .sort((a, b) => b.klik - a.klik || a.navn.localeCompare(b.navn, "da"));
}

/** Guide-slug fra stien, så /bedste/sovepose?utm=… og /bedste/sovepose er samme guide. */
export function guideSlug(sti: string | null): string | null {
  if (!sti) return null;
  const m = sti.split("?")[0].match(/^\/bedste\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

export interface Noegletal {
  klik: number;
  klikForrige: number;
  vaerdi: number;
  vaerdiForrige: number;
  medianPris: number | null;
  guiderMedKlik: number;
  /** Andel af klik der kom fra en købsguide — resten er shelter-sider, /tilbud osv. */
  andelFraGuider: number;
  grejVisninger: number;
  grejKlik: number;
  grejRate: number | null;
}

export function noegletal(klik: KlikRaekke[], events: EventRaekke[], nu: Date, dage: number): Noegletal {
  const start = new Date(nu.getTime() - dage * 86_400_000).toISOString();
  const forrigeStart = new Date(nu.getTime() - 2 * dage * 86_400_000).toISOString();
  const iVindue = klik.filter((k) => k.created_at >= start);
  const forrige = klik.filter((k) => k.created_at >= forrigeStart && k.created_at < start);

  const priser = iVindue.map((k) => k.price_dkk).filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const guider = new Set(iVindue.map((k) => guideSlug(k.path)).filter(Boolean));
  const evIVindue = events.filter((e) => e.created_at >= start);
  const grejV = evIVindue.filter((e) => e.event === "gear_block_seen").length;
  const grejK = evIVindue.filter((e) => e.event === "gear_suggestion_click").length;

  return {
    klik: iVindue.length,
    klikForrige: forrige.length,
    // Afrundet: priser i feedet har ører (243,1 kr.), og summen giver ellers
    // en flydende-komma-rest som 196.203,50000000006 i API-svaret.
    vaerdi: Math.round(iVindue.reduce((s, k) => s + (k.price_dkk ?? 0), 0)),
    vaerdiForrige: Math.round(forrige.reduce((s, k) => s + (k.price_dkk ?? 0), 0)),
    medianPris: priser.length ? priser[Math.floor(priser.length / 2)] : null,
    guiderMedKlik: guider.size,
    andelFraGuider: iVindue.length
      ? iVindue.filter((k) => guideSlug(k.path)).length / iVindue.length : 0,
    grejVisninger: grejV,
    grejKlik: grejK,
    grejRate: grejV > 0 ? grejK / grejV : null,
  };
}

export interface Produkt {
  navn: string;
  brand: string | null;
  forhandler: string | null;
  kategori: string | null;
  pris: number | null;
  klik: number;
}

export function topProdukter(klik: KlikRaekke[], loft = 25): Produkt[] {
  const m = new Map<string, Produkt>();
  for (const k of klik) {
    const navn = k.product_name ?? "(uden navn)";
    const p = m.get(navn);
    if (p) p.klik += 1;
    else m.set(navn, {
      navn, brand: k.brand, forhandler: k.retailer, kategori: k.category,
      pris: k.price_dkk, klik: 1,
    });
  }
  return [...m.values()].sort((a, b) => b.klik - a.klik || a.navn.localeCompare(b.navn, "da"))
    .slice(0, loft);
}

/** Klik pr. ugedag × klokketime, til et varmekort over hvornår folk køber. */
export function varmekort(klik: KlikRaekke[]): number[][] {
  const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const k of klik) {
    const d = dkUgedag(k.created_at);
    const t = dkTime(k.created_at);
    if (d >= 0 && d < 7 && t >= 0 && t < 24) g[d][t] += 1;
  }
  return g;
}

/**
 * Prisfordeling på de varer der bliver klikket på.
 *
 * Faste trin og ikke kvantiler: spørgsmålet er "sælger vi billigt eller dyrt
 * grej", og det svar skal ikke flytte sig, fordi fordelingen gør det.
 */
export const PRIS_TRIN = [0, 100, 250, 500, 1000, 2000, Infinity];

export function prisfordeling(klik: KlikRaekke[]): { fra: number; til: number; antal: number }[] {
  return PRIS_TRIN.slice(0, -1).map((fra, i) => {
    const til = PRIS_TRIN[i + 1];
    return {
      fra, til,
      antal: klik.filter((k) => k.price_dkk != null && k.price_dkk >= fra && k.price_dkk < til).length,
    };
  });
}
