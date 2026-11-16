import { createClient } from "@supabase/supabase-js";
import { findPrisfald, idagUTC, medPrisfald, type Prisfald, type Prispunkt } from "./prisfald";

/**
 * Databasedelen af lib/prisfald.ts. Kun til serveren: den bruger
 * service-noeglen, og den rene del skal kunne importeres af klientkomponenter
 * uden at slaebe Supabase-klienten med i bundtet.
 */

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Ventetid foer 2. og 3. forsoeg. Eksporteret saa testen ikke skal vente. */
export const GENFORSOEG_MS = [300, 900];

/**
 * Proever igen ved fejl, og giver foerst op efter tredje forsoeg.
 *
 * hentPrisfald kaster ved fejl (se nedenfor), og under et bygge betyder et
 * kast at hele deployet falder. Et lokalt bygge 16/11 2026 havde 7.771
 * "fetch failed" mod Supabase mens de 3.573 sider blev genereret, saa en
 * enkelt tabt forespoergsel er hverdag og ikke en grund til at vaelte noget.
 * Tre tabte i traek er en anden sag.
 */
async function medGenforsoeg<T extends { error: { message: string } | null }>(
  hent: () => PromiseLike<T>
): Promise<T> {
  let svar = await hent();
  for (const ms of GENFORSOEG_MS) {
    if (!svar.error) return svar;
    await new Promise((r) => setTimeout(r, ms));
    svar = await hent();
  }
  return svar;
}

/**
 * Henter historikken for varerne og slaar prisfaldet op for hver.
 *
 * KASTER ved fejl, med vilje. Guide-siderne er ISR: fejler en genopbygning,
 * bliver den forrige side staaende. Slugte vi fejlen, ville siden blive bygget
 * uden et eneste prisfald og ligge saadan i en time uden at nogen saa det.
 *
 * Tre kolonner og kun aendringsraekker, saa det er smaat: 200 varer er i dag
 * omkring 300 raekker. Der blades alligevel, fordi PostgREST stopper tavst
 * ved 1000 raekker, og historikken kun bliver laengere.
 */
export async function hentPrisfald(
  varer: { id: string; price: number }[],
  idag: string = idagUTC()
): Promise<Map<string, Prisfald>> {
  const ud = new Map<string, Prisfald>();
  if (varer.length === 0) return ud;
  const sb = db();
  const serier = new Map<string, Prispunkt[]>();
  const ids = [...new Set(varer.map((v) => v.id))];
  const PORTION = 100; // id'erne staar i URL'en
  const SIDE = 1000;
  for (let n = 0; n < ids.length; n += PORTION) {
    const portion = ids.slice(n, n + PORTION);
    for (let fra = 0; ; fra += SIDE) {
      const { data, error } = await medGenforsoeg(() =>
        sb
          .from("affiliate_price_history")
          .select("product_id, observeret, price")
          .in("product_id", portion)
          .order("product_id")
          .order("observeret")
          .range(fra, fra + SIDE - 1)
      );
      if (error) throw new Error(`Kunne ikke laese prishistorik: ${error.message}`);
      for (const r of data ?? []) {
        const id = r.product_id as string;
        const liste = serier.get(id) ?? [];
        liste.push({ observeret: r.observeret as string, price: Number(r.price) });
        serier.set(id, liste);
      }
      if ((data?.length ?? 0) < SIDE) break;
    }
  }
  for (const v of varer) {
    const fald = findPrisfald(serier.get(v.id) ?? [], v.price, idag);
    if (fald) ud.set(v.id, fald);
  }
  return ud;
}

/** hentPrisfald + medPrisfald for en hel liste. */
export async function anvendPrisfald<
  T extends { id: string; price: number; price_original: number | null; discount_pct: number | null }
>(varer: T[]): Promise<(T & { prisfald: Prisfald | null })[]> {
  const fald = await hentPrisfald(varer);
  return varer.map((v) => medPrisfald(v, fald.get(v.id) ?? null));
}
