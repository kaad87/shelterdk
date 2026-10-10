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
 * Alt /api/track tager imod. Står et event ikke her, svarer ruten 400, og
 * intet bliver gemt nogen steder.
 *
 * Listen bor sammen med INTERNAL_EVENTS, fordi den sidste er en delmængde af
 * den første, og den afhængighed var usynlig så længe de lå i to filer:
 * gear_block_seen blev tilføjet til INTERNAL_EVENTS alene og blev afvist ved
 * første port, så grej-blokkens visninger ville være målt til nul — den
 * konklusion eventet netop skulle modbevise. event-vokabular.test.ts holder
 * nu de to lister i trit.
 */
export const TRACKABLE_EVENTS = new Set([
  "search_performed",
  "filter_applied",
  "shelter_viewed",
  "view_item",
  "newsletter_signup",
  "share_click",
  "outbound_click",
  "affiliate_click",
  "gear_suggestion_click",
  "gear_block_seen",
  "guide_view",
  "community_submit",
  "book_button_clicked",
  "wishlist_changed",
  "add_to_wishlist",
  "payment_cancelled",
]);

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
  // Nævneren til grej-blokken. Blokken fik ét klik på otte dages måling, men
  // uden en visning kan "ingen bruger den" ikke skelnes fra "ingen ser den".
  // Den lå seks sektioner nede, og kun 4,4% af de 7255 visninger på
  // shelter-siderne scroller så dybt — så den anden forklaring var den rigtige.
  "gear_block_seen",
  "book_button_clicked",
  // Nævneren til affiliate-konvertering. Målt over 28 dage fik /bedste-siderne
  // 0,65 GA4-visninger pr. Google-klik — færre visninger end klik, altså
  // fysisk umuligt. Alle andre sidetyper lå på 1,5-4,8. Forskellen er
  // samtykkeløse pings og annonceblokering, der rammer googletagmanager.com
  // hårdest netop hos folk der søger på grej. Samme oprindelse slipper
  // igennem: affiliate-klik står 191 i Supabase mod 7 i GA4.
  "guide_view",
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
