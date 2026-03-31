import type { Shelter } from "../types/shelter";

const RAW = (s: Shelter) => (s.geofa_raw || {}) as Record<string, unknown>;

function getStr(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Fjern simpel HTML (p/br/span osv.) og bevar linjeskift nogenlunde. */
export function stripHtml(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  let text = value;
  // Konverter typiske linjeskift-tags til newline
  text = text.replace(/<\s*br\s*\/?>/gi, "\n");
  text = text.replace(/<\s*\/p\s*>/gi, "\n\n");
  // Bevar evt. bogstav i special-tag <t> (sjov HTML fra kilden),
  // men lad være med at erstatte alle enkeltbogstavs-tags (så undgår vi "pFri", "pHer" osv.)
  text = text.replace(/<\s*t\s*>/gi, "t");
  text = text.replace(/<\s*\/\s*t\s*>/gi, "");
  // Fjern alle resterende tags
  text = text.replace(/<[^>]+>/g, "");
  // Erstat non‑breaking space med almindelig space
  text = text.replace(/\u00a0/g, " ");
  // Tilføj mellemrum efter punktum/udråb/spørgsmål når næste tegn er bogstav (fx "navn.Organisation" → "navn. Organisation")
  text = text.replace(/([.!?])([A-ZÆØÅa-zæøå])/g, "$1 $2");
  // Ryd lidt op i mellemrum men bevar linjeskift (afsnit)
  text = text.replace(/[ \t]+/g, " ");
  // Slå mange linjeskift sammen til maks. ét tomt afsnit (bevar ét mellemrum mellem afsnit)
  text = text.replace(/\n{3,}/g, "\n\n");
  const trimmed = text.trim();
  return trimmed || null;
}

/** Lang beskrivelse fra GeoFA, renset for HTML. */
export function getLongDescription(shelter: Shelter): string | null {
  const raw = RAW(shelter);
  const val = getStr(raw, "lang_beskr", "lang_besk", "d_k_beskr", "beskrivels");
  return stripHtml(val);
}

/** Antal pladser – fra capacity-kolonne eller geofa_raw.antal_pl. */
export function getCapacity(shelter: Shelter): number | null {
  const cap = (shelter as { capacity?: number | null }).capacity;
  if (cap != null && Number.isFinite(Number(cap))) return Number(cap);
  const v = RAW(shelter).antal_pl;
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Adresse: vejnavn + postnr_by. */
export function getAddress(shelter: Shelter): string | null {
  const raw = RAW(shelter);
  const vej = getStr(raw, "vejnavn");
  const post = getStr(raw, "postnr_by");
  if (vej && post) return `${vej}, ${post}`;
  return vej || post || null;
}

/** By/kommune til visning (kommune-kolonnen eller udledt af geofa_raw). Viser aldrig rene tal (kommunekoder). */
function isValidCityName(value: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  const t = value.trim();
  return t.length > 0 && !/^\d+$/.test(t);
}

/** Konverter kommune-navn til by-navn til visning (alle skal vise by hvor muligt). */
function kommuneToBy(value: string): string {
  const t = value.trim();
  if (!t) return value;
  const s = t.toLowerCase();
  if (s.endsWith(" regionskommune")) {
    const regionMap: Record<string, string> = {
      "bornholms regionskommune": "Rønne",
      "københavns by": "København",
    };
    const mapped = regionMap[s];
    if (mapped) return mapped;
    return t.replace(/\s+Regionskommune$/i, "").trim() || t;
  }
  if (s.endsWith(" kommune")) return t.replace(/\s+Kommune$/i, "").trim() || t;
  return t;
}

/** Generer SEO-titel med bynavn. Original title bevares i shelter.title. Undgår generisk fallback for at reducere duplicate content. */
export function buildSeoTitle(shelter: Shelter): string {
  const name = (shelter.title || "").trim();
  const city = getCity(shelter);
  const region = (shelter.region ?? "").trim() || "Danmark";
  const by = city || (region !== "Danmark" ? region : null);
  const suffix = " | Shelterdk.dk";

  const isGenericOnly =
    !name ||
    /^shelter\s*$/i.test(name) ||
    /^shelterplads\s*$/i.test(name);

  if (isGenericOnly) {
    const place = shelter.place && typeof shelter.place === "string" ? shelter.place.trim() : null;
    const vejnavn = getStr(RAW(shelter), "vejnavn");
    if (by && place && place !== by) {
      return `Shelter ved ${place} i ${by}${suffix}`;
    }
    if (by && vejnavn && vejnavn.length > 2) {
      return `Shelter ved ${vejnavn} i ${by}${suffix}`;
    }
    if (by && region !== "Danmark") {
      return `Shelter i ${by}, ${region}${suffix}`;
    }
    if (by) {
      return `Shelter i ${by}${suffix}`;
    }
    return `Shelter - Overnatning i naturen${suffix}`;
  }

  if (!by) {
    return name + suffix;
  }

  const nameLower = name.toLowerCase();
  const byLower = by.toLowerCase();
  if (nameLower.includes(byLower)) {
    return name + suffix;
  }

  return `${name} i ${by}${suffix}`;
}

/** By/stedsnavn til visning – foretrækker præcist sted (place), ellers kommune eller GeoFA. */
export function getCity(shelter: Shelter): string | null {
  const place = shelter.place && typeof shelter.place === "string" ? shelter.place.trim() : null;
  if (isValidCityName(place)) return place;
  const fromKommune = shelter.kommune && typeof shelter.kommune === "string" ? shelter.kommune.trim() : null;
  if (isValidCityName(fromKommune)) return kommuneToBy(fromKommune!);
  const raw = RAW(shelter);
  const postnrBy = getStr(raw, "postnr_by");
  if (postnrBy) {
    const cleaned = postnrBy.replace(/^\s*\d+\s*[,-]?\s*/, "").trim();
    if (isValidCityName(cleaned)) return cleaned;
  }
  const kommune = getStr(raw, "beliggenhedskommune");
  if (isValidCityName(kommune)) return kommune;
  return null;
}

/** Ansvarlig organisation (ejer/forvalter). */
export function getOwner(shelter: Shelter): string | null {
  return getStr(RAW(shelter), "ansvar_org");
}

/** Kontakt (e-mail, telefon). */
export function getContact(shelter: Shelter): string | null {
  return getStr(RAW(shelter), "kontak_ved");
}

/** Sæson (åben/lukket) + evt. bemærkning. */
export function getSeason(shelter: Shelter): { label: string; note?: string } | null {
  const raw = RAW(shelter);
  const saeson = getStr(raw, "saeson");
  const bem = getStr(raw, "saeson_bem");
  if (!saeson && !bem) return null;
  return { label: saeson || "Sæson", note: bem || undefined };
}

/** Døgnåben ja/nej. */
export function getOpen24_7(shelter: Shelter): boolean | null {
  const v = (getStr(RAW(shelter), "doegnaab") || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

/** Handicaptilgængelighed. */
export function getWheelchair(shelter: Shelter): boolean | null {
  const v = (getStr(RAW(shelter), "handicap") || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

/** Betaling (gratis / betaling). */
export function getPayment(shelter: Shelter): string | null {
  return getStr(RAW(shelter), "betaling");
}

/** Tilgængelighedsbeskrivelse (parkering, belægning osv.). */
export function getAccessDescription(shelter: Shelter): string | null {
  return getStr(RAW(shelter), "tilgaeng_beskriv", "tilgaeng_opl");
}

/** Bålplads fra geofa_raw. */
export function getFirewood(shelter: Shelter): boolean | null {
  const v = (getStr(RAW(shelter), "baalplads") || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

/** Vand på pladsen (vandhane/drikkevand). Foretrækker DB-kolonnen water, ellers geofa_raw.vandhane. */
export function getWater(shelter: Shelter): boolean | null {
  if (shelter.water === true || shelter.water === false) return shelter.water;
  const v = (getStr(RAW(shelter), "vandhane") || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
  return null;
}

/** Toilet på pladsen: fra DB-kolonne eller ukendt. */
export function getToilet(
  shelter: Shelter
): "flush" | "mulch" | "none" | "unknown" | null {
  const t = shelter.toilet;
  if (t === "flush" || t === "mulch" || t === "none" || t === "unknown")
    return t;
  return null;
}

/** Må man have hund/dyr med? Udledt af geofa_raw eller beskrivelse. */
export function getPetsAllowed(shelter: Shelter): boolean | null {
  const raw = RAW(shelter);
  const petKeys = ["hunde_tilladt", "hund", "dyr", "pets", "husdyr"];
  for (const key of petKeys) {
    const v = getStr(raw, key);
    if (!v) continue;
    const lower = v.toLowerCase();
    if (lower.includes("ja")) return true;
    if (lower.includes("nej")) return false;
  }
  const desc = (getLongDescription(shelter) || "").toLowerCase();
  if (desc.includes("hund") || desc.includes("dyr")) {
    if (desc.includes(" tilladt") || desc.includes(" må ") || (desc.includes("ja") && desc.includes("medbring"))) return true;
    if (desc.includes("ikke tilladt") || desc.includes("ingen hund")) return false;
  }
  return null;
}

/** Saml "faciliteter" til visning som chips (Landfolk/Airbnb-style). */
export interface ShelterFeature {
  label: string;
  value?: string;
}

export function getFeatures(shelter: Shelter): ShelterFeature[] {
  const raw = RAW(shelter);
  const out: ShelterFeature[] = [];

  const cap = getCapacity(shelter);
  if (cap != null) out.push({ label: "Pladser", value: `${cap}` });

  const region = shelter.region;
  if (region) out.push({ label: "Region", value: region });

  const open = getOpen24_7(shelter);
  if (open === true) out.push({ label: "Døgnåben" });
  if (open === false) out.push({ label: "Ikke døgnåben" });

  const wheelchair = getWheelchair(shelter);
  if (wheelchair === true) out.push({ label: "Handicaptilgængelig" });
  if (wheelchair === false) out.push({ label: "Ikke handicapvenlig" });

  const payment = getPayment(shelter);
  if (payment) {
    const p = payment.toLowerCase();
    if (p.includes("nej")) out.push({ label: "Gratis" });
    else out.push({ label: "Betaling", value: payment });
  }

  const toilet = getToilet(shelter);
  if (toilet === "flush") out.push({ label: "Toilet" });
  if (toilet === "mulch") out.push({ label: "Muldtoilet" });

  const water = getWater(shelter);
  if (water === true) out.push({ label: "Vand" });
  if (water === false) out.push({ label: "Ingen vand" });

  // Bålplads (fra geofa_raw)
  const baal = getStr(raw, "baalplads");
  if (baal && baal.toLowerCase().includes("ja")) out.push({ label: "Bålplads" });

  // Bord/bænke (fra geofa_raw)
  const bb = getStr(raw, "bord_baenk");
  if (bb && bb.toLowerCase().includes("ja")) out.push({ label: "Bord/bænke" });

  // Hund tilladt (fra geofa_raw)
  const pets = getPetsAllowed(shelter);
  if (pets === true) out.push({ label: "Hund tilladt" });

  // Strand nærhed (fra geofa_raw)
  const strand = getStr(raw, "strand_naerhed");
  if (strand && strand.toLowerCase().includes("ja")) out.push({ label: "Nær strand" });

  // Bruser/bad (fra geofa_raw)
  const bruser = getStr(raw, "bruser_bad");
  if (bruser && bruser.toLowerCase().includes("ja")) out.push({ label: "Bruser/bad" });

  const book = getStr(raw, "book");
  if ((book || "").toLowerCase().includes("ja") || shelter.booking_url)
    out.push({ label: "Bookbar" });

  const season = getSeason(shelter);
  if (season) out.push({ label: "Sæson", value: season.note || season.label });

  const address = getAddress(shelter);
  if (address) out.push({ label: "Adresse", value: address });

  return out;
}

/** True hvis shelteret anses for bookbart (booking_url, titel "bookbar", eller geofa book=ja). */
export function isBookable(shelter: Shelter): boolean {
  if ((shelter.booking_url || "").trim()) return true;
  const raw = RAW(shelter);
  const book = getStr(raw, "book");
  if ((book || "").toLowerCase().includes("ja")) return true;
  const title = (shelter.title || "").toLowerCase();
  if (title.includes("bookbar")) return true;
  return false;
}

const GEOFA_PHOTO_KEYS = [
  "foto_link", "foto_link1", "foto_link2", "foto_link3",
  "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3",
];

/** True hvis strengen ligner en rigtig billed-URL (http(s) og ikke HTML som "<a>Link</a>"). */
export function isValidImageUrl(url: string | null | undefined): boolean {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u || u.length < 10) return false;
  if (u.includes("<") || u.includes(">")) return false;
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  return true;
}

/** Slugs hvor de første N billeder springes over på sheltersiden (fx uønskede/gentagne). */
const SKIP_FIRST_IMAGES: Record<string, number> = {
  "shelterplads-med-balplads-og-borde-og-baenke-14806": 4,
};

/** URL-mønstre for billeder der ikke må vises (fx sponsor-/annoncebilleder). */
const EXCLUDED_IMAGE_PATTERNS = [
  "a_p_moller_fonden",
  "moller_fonden",
  "a_p_moller-fonden",
  "moller-fonden",
];

function isExcludedImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return EXCLUDED_IMAGE_PATTERNS.some((p) => lower.includes(p));
}

/** Saml alle billed-URL'er fra image_url, image_urls (jsonb) og geofa_raw. Dedupe, filtrer cookiebot/1.gif, A.P. Møller Fonden og ugyldige URL'er. */
export function getPhotoUrls(shelter: Shelter): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: string | null | undefined) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || u.includes("cookiebot.com") || u.endsWith("/1.gif") || seen.has(u)) return;
    if (isExcludedImageUrl(u)) return;
    if (!isValidImageUrl(u)) return;
    seen.add(u);
    out.push(u);
  };
  if (isValidImageUrl(shelter.image_url)) add(shelter.image_url);
  const urls = shelter.image_urls;
  if (Array.isArray(urls)) {
    for (const url of urls) add(url);
  }
  const userUrls = shelter.user_image_urls;
  if (Array.isArray(userUrls)) {
    for (const url of userUrls) add(url);
  }
  const raw = RAW(shelter);
  for (const k of GEOFA_PHOTO_KEYS) add(raw[k] as string | undefined);
  const skip = shelter.slug ? SKIP_FIRST_IMAGES[shelter.slug] : 0;
  return skip > 0 ? out.slice(skip) : out;
}

/** Er URL'en fra Google (lh3.googleusercontent.com)? */
function isGoogleImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    return new URL(url).hostname.includes("googleusercontent.com");
  } catch {
    return false;
  }
}

/** URL til Google Place Photo proxy (bruger photo_reference i stedet for udløbet signed URL). */
export function getGooglePhotoProxyUrl(ref: string, maxwidth = 1200): string {
  if (!ref || typeof ref !== "string" || ref.length < 10) return "";
  return `/api/google-photo?ref=${encodeURIComponent(ref.trim())}&maxwidth=${maxwidth}`;
}

/** Samme som getPhotoUrls, men erstatter Google-billeder med proxy-URL når firstGooglePhotoRef er sat. */
export function getResolvedPhotoUrls(
  shelter: Shelter,
  firstGooglePhotoRef?: string | null
): string[] {
  const embeddedPlaces = shelter.google_places;
  const embeddedRefs = Array.isArray(embeddedPlaces)
    ? embeddedPlaces?.[0]?.photo_references
    : embeddedPlaces?.photo_references;
  const derivedRef =
    firstGooglePhotoRef ??
    (Array.isArray(embeddedRefs) ? (embeddedRefs?.[0] ?? null) : null);
  const urls = getPhotoUrls(shelter);
  if (!derivedRef || urls.length === 0) return urls;
  const first = urls[0];
  if (isGoogleImageUrl(first)) {
    const proxy = getGooglePhotoProxyUrl(derivedRef);
    if (proxy) return [proxy, ...urls.slice(1)];
  }
  return urls;
}

/** URL til det billede der skal vises på kort/liste (respekterer SKIP_FIRST_IMAGES og ekskluderede billeder). */
export function getDisplayImageUrl(shelter: Shelter): string | null {
  const urls = getPhotoUrls(shelter);
  const first = urls[0];
  return first && isValidImageUrl(first) ? first : null;
}

/** Samme som getDisplayImageUrl, men med Google proxy når firstGooglePhotoRef er sat. */
export function getResolvedDisplayImageUrl(
  shelter: Shelter,
  firstGooglePhotoRef?: string | null
): string | null {
  const urls = getResolvedPhotoUrls(shelter, firstGooglePhotoRef);
  const first = urls[0];
  return first ? first : null;
}

/**
 * Har shelter mindst ét gyldigt billede (image_url, image_urls eller user_image_urls)?
 */
export function hasAnyImage(shelter: Shelter): boolean {
  if (isValidImageUrl(shelter.image_url)) return true;
  if (Array.isArray(shelter.image_urls) && shelter.image_urls.length > 0) return true;
  if (Array.isArray(shelter.user_image_urls) && shelter.user_image_urls.length > 0) return true;
  return false;
}

/**
 * Beregn display_score til rangering (samme formel som DB: billeder * 100 + min(anmeldelser, 500)).
 * Brug til sortering når DB-score mangler eller for at sikre korrekt rækkefølge.
 */
export function getDisplayScore(shelter: Shelter): number {
  let imageCount = isValidImageUrl(shelter.image_url) ? 1 : 0;
  if (Array.isArray(shelter.image_urls)) imageCount += shelter.image_urls.length;
  if (Array.isArray(shelter.user_image_urls)) imageCount += shelter.user_image_urls.length;
  const reviews = Math.min(
    500,
    Math.max(0, Number(shelter.google_user_ratings_total) || 0)
  );
  return imageCount * 100 + reviews;
}

/** Om det matchede Google-stednavn indeholder "shelter" – vis rating/anmeldelser kun da. */
export function isShelterPlace(placeName: string | null): boolean {
  if (!placeName || typeof placeName !== "string") return false;
  return placeName.toLowerCase().trim().includes("shelter");
}

/**
 * Generér en fallback-beskrivelse når shelter mangler seo_description og lang_beskr.
 * Bruges til at sikre at alle shelter-detaljesider har mindst 2-3 sætninger unikt indhold.
 */
export function generateFallbackDescription(shelter: Shelter): string | null {
  const title = shelter.title?.trim();
  if (!title) return null;

  const city = getCity(shelter);
  const region = shelter.region?.trim();
  const cap = getCapacity(shelter);
  const toilet = getToilet(shelter);
  const water = getWater(shelter);
  const pets = getPetsAllowed(shelter);
  const bookable = isBookable(shelter);

  const parts: string[] = [];

  // Sætning 1: Hvad og hvor
  let s1 = `${title} er et shelter`;
  if (city && region && region !== "Danmark") {
    s1 += ` i ${city}, ${region}`;
  } else if (city) {
    s1 += ` i ${city}`;
  } else if (region && region !== "Danmark") {
    s1 += ` i ${region}`;
  }
  if (cap && cap > 0) {
    s1 += ` med plads til ${cap} person${cap !== 1 ? "er" : ""}`;
  }
  s1 += ".";
  parts.push(s1);

  // Sætning 2: Faciliteter
  const facilities: string[] = [];
  if (toilet === "flush") facilities.push("vandskyllende toilet");
  else if (toilet === "mulch") facilities.push("muldtoilet");
  if (water === true) facilities.push("adgang til vand");
  if (pets === true) facilities.push("hundevenlig");

  if (facilities.length > 0) {
    const facilityStr = facilities.length === 1
      ? facilities[0]
      : facilities.slice(0, -1).join(", ") + " og " + facilities[facilities.length - 1];
    parts.push(`Pladsen har ${facilityStr}.`);
  }

  // Sætning 3: Booking
  if (bookable) {
    parts.push("Shelteren kan bookes på forhånd, hvilket anbefales i højsæsonen.");
  } else {
    parts.push("Shelteren fungerer efter først-til-mølle-princippet.");
  }

  return parts.join(" ");
}

/** Parse location (POINT(lon lat) eller GeoJSON) til { lat, lon } for kortlink. */
export function getLocationCoords(shelter: Pick<Shelter, "location">): { lat: number; lon: number } | null {
  const loc = shelter.location;
  if (!loc) return null;
  if (typeof loc === "object" && loc !== null && "coordinates" in loc) {
    const c = (loc as { coordinates: number[] }).coordinates;
    if (Array.isArray(c) && c.length >= 2) return { lon: c[0], lat: c[1] };
  }
  if (typeof loc === "string") {
    const m = loc.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i);
    if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}
