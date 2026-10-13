/**
 * Laeser koordinater ud af det man faar, naar man kopierer fra Google Maps.
 *
 * Google giver fire ting afhaengigt af hvad man klikker paa, og de ser alle
 * forskellige ud:
 *
 *   55.924147, 12.296374                 "Kopiér koordinater" i hoejreklik
 *   55°55'26.9"N 12°17'46.9"E            samme menu, i grader-minutter-sekunder
 *   https://www.google.com/maps/@55.92,12.29,15z     adresselinjen
 *   https://maps.app.goo.gl/xYz          "Del" (kort link, ingen koordinater)
 *
 * De tre foerste kan laeses. Det korte dele-link kan ikke: det skal foelges
 * for at finde stedet, og det goer vi ikke. Saa siger funktionen fra i stedet
 * for at gaette.
 */

/** Danmarks omtrentlige udstraekning, inkl. Bornholm og Nordsoeen. */
const DK = { latMin: 54.4, latMax: 57.9, lngMin: 7.8, lngMax: 15.3 };

export interface Koordinat {
  lat: number;
  lng: number;
  /** Sandt naar de to tal stod i omvendt raekkefoelge og blev byttet om. */
  byttet: boolean;
}

function iDanmark(lat: number, lng: number): boolean {
  return lat >= DK.latMin && lat <= DK.latMax && lng >= DK.lngMin && lng <= DK.lngMax;
}

/** Grader, minutter, sekunder til decimalgrader. */
function fraDms(grad: string, min: string, sek: string, retning: string): number {
  const v = Number(grad) + Number(min) / 60 + Number(sek || 0) / 3600;
  return /[sw]/i.test(retning) ? -v : v;
}

const DMS = new RegExp(
  "(\\d+)[°\\s]+(\\d+)['′\\s]+([\\d.]+)?[\"″\\s]*([NSEWnsew])",
  "g",
);

/**
 * Finder et koordinatpar i en tekst, eller null.
 *
 * Bytter om paa de to tal, hvis de tydeligvis staar omvendt. Det er ikke
 * overfortolkning: 12,29 kan ikke vaere en breddegrad i Danmark, og en
 * ombyttet koordinat lander stedet i Somalia uden at nogen opdager det, fordi
 * kortet bare viser havet.
 */
export function laesKoordinat(raw: string): Koordinat | null {
  const tekst = (raw || "").trim();
  if (!tekst) return null;

  // Grader-minutter-sekunder: 55°55'26.9"N 12°17'46.9"E
  const dms = [...tekst.matchAll(DMS)];
  if (dms.length >= 2) {
    const a = fraDms(dms[0][1], dms[0][2], dms[0][3], dms[0][4]);
    const b = fraDms(dms[1][1], dms[1][2], dms[1][3], dms[1][4]);
    const førsteErBredde = /[ns]/i.test(dms[0][4]);
    return ordn(førsteErBredde ? a : b, førsteErBredde ? b : a);
  }

  // En Google Maps-adresse: koordinaterne staar efter @ eller i !3d/!4d.
  const url = tekst.match(/[@/](-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/)
    ?? tekst.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (url) return ordn(Number(url[1]), Number(url[2]));

  // To tal: "55.924147, 12.296374" eller med mellemrum eller semikolon.
  // Kraever decimaler, saa "2, 3" fra en helt anden tekst ikke opfattes som
  // et sted midt i Atlanterhavet.
  const par = tekst.match(/^\s*(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)\s*$/);
  if (par) {
    // Komma kan vaere decimaltegn ELLER skilletegn. Staar der to kommaer, er
    // det foerste og sidste decimaltegn; staar der ét, er det skilletegnet.
    const tal = (x: string) => Number(x.replace(",", "."));
    return ordn(tal(par[1]), tal(par[2]));
  }
  const danskPar = tekst.match(/^\s*(-?\d{1,3},\d+)\s*;\s*(-?\d{1,3},\d+)\s*$/);
  if (danskPar) {
    return ordn(Number(danskPar[1].replace(",", ".")), Number(danskPar[2].replace(",", ".")));
  }
  return null;
}

function ordn(lat: number, lng: number): Koordinat | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    // Maaske byttet om: en "breddegrad" over 90 findes ikke.
    if (Math.abs(lng) <= 90 && Math.abs(lat) <= 180) return { lat: lng, lng: lat, byttet: true };
    return null;
  }
  if (!iDanmark(lat, lng) && iDanmark(lng, lat)) return { lat: lng, lng: lat, byttet: true };
  return { lat, lng, byttet: false };
}

/** Ligger punktet i Danmark? Bruges til at advare, ikke til at afvise. */
export function erIDanmark(lat: number, lng: number): boolean {
  return iDanmark(lat, lng);
}
