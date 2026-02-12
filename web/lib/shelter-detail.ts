import type { Shelter } from "@/types/shelter";

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

/** Antal pladser (antal_pl). */
export function getCapacity(shelter: Shelter): number | null {
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

export function getCity(shelter: Shelter): string | null {
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

/** Vandhane. */
export function getWater(shelter: Shelter): boolean | null {
  const v = (getStr(RAW(shelter), "vandhane") || "").toLowerCase();
  if (v.includes("ja")) return true;
  if (v.includes("nej")) return false;
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

  const water = getWater(shelter);
  if (water === true) out.push({ label: "Vand" });
  if (water === false) out.push({ label: "Ingen vand" });

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

/** Saml alle billed-URL'er fra image_url, image_urls (jsonb) og geofa_raw. Dedupe, filtrer cookiebot/1.gif og ugyldige URL'er. */
export function getPhotoUrls(shelter: Shelter): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: string | null | undefined) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || u.includes("cookiebot.com") || u.endsWith("/1.gif") || seen.has(u)) return;
    if (!isValidImageUrl(u)) return;
    seen.add(u);
    out.push(u);
  };
  if (isValidImageUrl(shelter.image_url)) add(shelter.image_url);
  const urls = shelter.image_urls;
  if (Array.isArray(urls)) {
    for (const url of urls) add(url);
  }
  const raw = RAW(shelter);
  for (const k of GEOFA_PHOTO_KEYS) add(raw[k] as string | undefined);
  return out;
}

/** Om det matchede Google-stednavn indeholder "shelter" – vis rating/anmeldelser kun da. */
export function isShelterPlace(placeName: string | null): boolean {
  if (!placeName || typeof placeName !== "string") return false;
  return placeName.toLowerCase().trim().includes("shelter");
}

/** Parse location (POINT(lon lat) eller GeoJSON) til { lat, lon } for kortlink. */
export function getLocationCoords(shelter: Shelter): { lat: number; lon: number } | null {
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
