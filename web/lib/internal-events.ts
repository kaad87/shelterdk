/**
 * Egne events der logges til Supabase ved siden af GA4.
 *
 * GA4-vejen i server-analytics.ts er bag en samtykkeport, og consent-cookien
 * sættes først når nogen trykker i banneret. Målt over 28 dage: affiliate_click
 * står til 7 i GA4 mod 222 i affiliate_clicks — omkring 3%. Events vi skal
 * træffe beslutninger på, skal derfor også skrives her, hvor optællingen er
 * fuld.
 *
 * Rækkerne er anonyme: ingen IP, user-agent, bruger- eller sessions-id. Kun
 * eventnavn, sti og ikke-identificerende parametre. Samme grundlag som
 * affiliate_clicks.
 */

/**
 * Hvilke events der dubleres til internal_events.
 *
 * Affiliate-klik står ikke på listen — de har deres egen tabel med
 * produkt- og prisfelter. Book-knappen gør, fordi GA4 kun så 71 klik på 28
 * dage; det tal er en stikprøve af de samtykkende, ikke virkeligheden, og
 * forholdet mellem klik og faktiske bookinger i shelter_bookings er det
 * eneste, der viser om booking-flowet taber folk undervejs.
 */
export const INTERNAL_EVENTS = new Set([
  "gear_suggestion_click",
  "book_button_clicked",
]);

/** Parametre der aldrig må logges, uanset hvor de kommer fra. */
const FORBUDTE = new Set([
  "email", "name", "navn", "phone", "telefon", "address", "adresse",
  "ip", "user_agent", "client_id", "session_id", "user_id", "cid", "uid",
]);

const MAX_VAERDI = 200;
const MAX_PATH = 300;
const MAX_PARAMS = 12;

export interface InternalEventRow {
  event: string;
  path: string | null;
  params: Record<string, string | number | boolean>;
}

export function internalEventRow(
  event: string,
  params: unknown,
  path: unknown
): InternalEventRow {
  const ud: Record<string, string | number | boolean> = {};
  if (params && typeof params === "object" && !Array.isArray(params)) {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (Object.keys(ud).length >= MAX_PARAMS) break;
      if (FORBUDTE.has(k.toLowerCase())) continue;
      if (typeof v === "string") ud[k] = v.slice(0, MAX_VAERDI);
      else if (typeof v === "number" || typeof v === "boolean") ud[k] = v;
      // alt andet (objekter, arrays, null) droppes
    }
  }
  return {
    event: event.slice(0, 80),
    path: typeof path === "string" ? path.slice(0, MAX_PATH) : null,
    params: ud,
  };
}
