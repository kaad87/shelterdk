/**
 * Billed-URL'er fra affiliate-feeds, og den ene fejl der kan ses uden at spoerge.
 *
 * MAALT 14. NOVEMBER 2026. Guide-monitoren meldte 11 varer i 11 forskellige
 * guider med et billede der ikke svarede. Alle 11 var fra backpackerlife. Ved
 * at tjekke hele deres sortiment viste der sig et rent moenster:
 *
 *   billed-URL MED mellemrum :  79 varer ->   0 levende,  79 doede
 *   billed-URL UDEN mellemrum : 100 stikproeve -> 100 levende, 0 doede
 *
 * Ingen undtagelser i nogen af retningerne. Forklaringen er at WordPress
 * saniterer filnavne ved upload og aldrig gemmer en fil med mellemrum i
 * navnet, saa de URL'er har ALDRIG eksisteret — feedet har bygget dem ud af
 * varens titel i stedet for at skrive den rigtige vedhaeftning.
 * "Dry bag med kompression  -  Sea to Summit Evac  -  8 liter" bliver til
 * ".../Dry-bag-med-kompression- - -Sea-to-Summit-Evac- - -8-liter-1-1.png".
 * Hverken mellemrummene fjernet, erstattet af bindestreger eller af
 * understregninger giver en fil der findes; der er ikke noget at gaette paa.
 *
 * Et raat mellemrum er i oevrigt ugyldigt i en URL (RFC 3986) uanset
 * forhandler, saa reglen kan ikke komme til at kassere et billede der virker.
 * Den gaelder derfor alle feeds og ikke kun backpackerlife.
 *
 * VIGTIGT: reglen maa ikke bruges til at goere problemet tavst. Synken
 * undlader at gemme URL'en, men guide-monitoren melder stadig varen, fordi
 * den ser efter et BRUGBART billede og ikke kun efter en doed URL. Uden det
 * ville guiderne stille og roligt miste deres produktfotos, og et produktfoto
 * er et koebssignal.
 */

/** Hvidt tegn hvor som helst i en URL. Kodet mellemrum (%20) er i orden. */
const RAAT_MELLEMRUM = /\s/;

/**
 * URL'en hvis den overhovedet kan pege paa en fil, ellers null.
 * Kaldes baade naar feedet laeses (synken) og naar billedet vises, saa en
 * raekke der allerede ligger i databasen ogsaa haandteres rigtigt.
 */
export function brugbartBillede(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (RAAT_MELLEMRUM.test(u)) return null;
  return u;
}
