/**
 * Rydder op i en Booking.com-adresse, foer den gemmes.
 *
 * En adresse kopieret fra browseren baerer hele soegningen med sig, og tre af
 * de parametre maa ikke gemmes:
 *
 *   sid    Et SESSIONS-id, knyttet til den browser der kopierede linket. Det
 *          er personhenfoerbart, det doer efter kort tid, og det hoerer
 *          hverken hjemme i vores database eller i et link vi sender videre.
 *
 *   aid    Booking-partnerens id. I de eksempler vi har set staar der 356980,
 *          som IKKE er vores. Gemmes det, krediteres hver booking en anden.
 *          Vores eget id hoerer til i CJ-deeplinket, ikke i selve adressen.
 *
 *   label  Partnerens sporings-etiket, altsaa ogsaa en andens.
 *
 * Resten (dest_id, hapos, srpvid, srepoch, group_adults ...) beskriver den
 * soegning linket kom fra. Den er doed i det oejeblik den gemmes, og den
 * laegger 300 tegn til hver raekke uden at sige noget.
 *
 * Tilbage staar den kanoniske adresse:
 *   https://www.booking.com/hotel/dk/<slug>.da.html
 *
 * Sproget tvinges til dansk. Fire af de fem eksempler pegede paa en-gb,
 * fordi de blev kopieret fra en engelsk session, og en dansk bruger skal
 * ikke sendes til en engelsk side.
 */

const BOOKING_HOSTS = new Set([
  "booking.com", "www.booking.com", "secure.booking.com",
]);

/** Sproget vi sender danske brugere til. */
const SPROG = "da";

export interface BookingUrl {
  /** Den kanoniske adresse, klar til at gemme. */
  kanonisk: string;
  /** Property-slug, som ogsaa er den stabile noegle paa tvaers af sprog. */
  slug: string;
  /** Landekode i stien, fx "dk". */
  land: string;
  /** Hvad der blev fjernet, saa en admin kan se at det skete og hvorfor. */
  fjernet: string[];
}

/**
 * Laeser en Booking-adresse og returnerer den kanoniske form.
 *
 * Returnerer null for alt der ikke er en Booking-property-side. Et CJ-deeplink
 * eller et link til Landjord hoerer til i et andet felt og skal ikke
 * forsoeges "repareret" her: en stilfaerdig omskrivning af et link, vi ikke
 * forstod, er vaerre end at sige fra.
 */
export function laesBookingUrl(raw: string): BookingUrl | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (!BOOKING_HOSTS.has(u.hostname.toLowerCase())) return null;

  // /hotel/<land>/<slug>[.<sprog>].html
  const m = u.pathname.match(/^\/hotel\/([a-z]{2})\/([^/]+?)\.(?:[a-z]{2}(?:-[a-z]{2})?\.)?html$/i);
  if (!m) return null;

  const [, land, slug] = m;
  const fjernet: string[] = [];
  for (const noegle of ["sid", "aid", "label"]) {
    if (u.searchParams.has(noegle)) fjernet.push(noegle);
  }
  const øvrige = [...u.searchParams.keys()].filter((k) => !["sid", "aid", "label"].includes(k));
  if (øvrige.length) fjernet.push(`${øvrige.length} søgeparametre`);

  return {
    kanonisk: `https://www.booking.com/hotel/${land.toLowerCase()}/${slug}.${SPROG}.html`,
    slug,
    land: land.toLowerCase(),
    fjernet,
  };
}

/**
 * Samme, men giver den oprindelige streng tilbage, hvis den ikke er en
 * Booking-adresse. Til felter der ogsaa kan rumme et CJ-deeplink eller et
 * link til Landjord eller Campanyon.
 */
export function normaliserHvisBooking(raw: string): string {
  return laesBookingUrl(raw)?.kanonisk ?? (raw || "").trim();
}

/** To adresser peger paa samme sted, naar slug og land er ens. */
export function sammeProperty(a: string, b: string): boolean {
  const x = laesBookingUrl(a);
  const y = laesBookingUrl(b);
  return !!x && !!y && x.slug === y.slug && x.land === y.land;
}


// ---------------------------------------------------------------------------
// CJ-deeplink
// ---------------------------------------------------------------------------

/**
 * Vores egne CJ-id'er. De er ikke hemmelige: de staar i hver eneste udgaaende
 * adresse og kan laeses af enhver der hoejreklikker. Derfor konstanter og ikke
 * env, saa de kan testes og ses i en diff.
 *
 * PID er vores promotional property (ShelterDK). LINK_ID hoerer til parret
 * ShelterDK x Booking.com Nordics; en anden annoncoer faar sit eget.
 */
export const CJ_HOST = "www.tkqlhce.com";
export const CJ_PID = "101800945";
export const CJ_LINK_ID = "15734870";

/**
 * Hvor paa sitet klikket skete. Vaerdien sendes som CJ's SID, saa indtjening
 * kan gores op pr. placering uden at gemme tre forskellige links pr. sted.
 *
 * Navnene er korte med vilje: SID foelger med gennem hele CJ's rapportering,
 * og et langt navn bliver afkortet et sted undervejs.
 */
export type Placering = "kort" | "shelter" | "guide" | "side";

/**
 * Bygger CJ-deeplinket til en Booking-adresse.
 *
 * Linket bygges ved rendering og gemmes ikke. Gemte vi det faerdige deeplink,
 * skulle der ligge ét pr. placering pr. sted, og et skift af link-id ville
 * kraeve en opdatering af hver raekke. Med den kanoniske adresse i basen er
 * der ét felt at vedligeholde, og SID kan saettes frit pr. visning.
 */
export function cjDeeplink(bookingUrl: string, sid?: Placering | string): string | null {
  const b = laesBookingUrl(bookingUrl);
  if (!b) return null;
  const base = `https://${CJ_HOST}/click-${CJ_PID}-${CJ_LINK_ID}`;
  const params = new URLSearchParams({ url: b.kanonisk });
  if (sid) params.set("sid", sid);
  return `${base}?${params.toString()}`;
}

/** CJ-klikadresse: https://<cj-host>/click-<pid>-<id>?url=<destination> */
const CJ_KLIK = /^\/click-\d+-\d+$/;

/**
 * Pakker et CJ-deeplink ud og giver destinationen tilbage.
 *
 * Bruges naar nogen indsaetter et faerdigt deeplink i admin: vi gemmer hellere
 * den kanoniske Booking-adresse og bygger sporingen selv, saa SID kan saettes
 * pr. placering. Et gemt deeplink har ét fast SID og kan ikke skelne mellem
 * et klik paa kortet og et klik paa en underside.
 */
export function udpakCjDeeplink(raw: string): string | null {
  let u: URL;
  try {
    u = new URL((raw || "").trim());
  } catch {
    return null;
  }
  if (!CJ_KLIK.test(u.pathname)) return null;
  const maal = u.searchParams.get("url");
  return maal ? maal : null;
}

/**
 * Den adresse en knap skal pege paa.
 *
 * Booking-adresser pakkes i CJ med placeringens SID. Alt andet (Landjord,
 * Campanyon, stedets egen side) gaar uroert igennem: vi har ingen sporing paa
 * dem, og et link vi ikke forstod maa ikke blive omskrevet.
 */
export function udgaaendeLink(bookingUrl: string | null, placering: Placering): string | null {
  if (!bookingUrl) return null;
  return cjDeeplink(bookingUrl, placering) ?? bookingUrl.trim() ?? null;
}
