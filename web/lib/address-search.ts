/**
 * Adressesøgning til admin-fladerne.
 *
 * Erstatter DAWA's /adgangsadresser/autocomplete, som lukkede permanent
 * 1. oktober 2026. Klimadatastyrelsens afløser (Adressevælgeren) kræver et
 * token fra Dataforsyningen; indtil det er oprettet, bruges Nominatim, som
 * håndterer danske adresser med husnummer, postnummer og kommune.
 *
 * Nominatims brugspolitik tillader maks. ét kald i sekundet pr. applikation og
 * kræver en identificerbar User-Agent eller Referer. Feltet bruges kun i admin
 * af en enkelt person, så volumen er forsvindende — men kaldet skal være
 * debounced, og søgning starter først ved tre tegn.
 */

export interface AddressHit {
  /** Vist i listen og skrevet tilbage i feltet. */
  tekst: string;
  lat: number;
  lon: number;
  /** Bynavn til stedangivelse, hvis det kendes. */
  place: string | null;
}

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
}

/** Dansk adresselinje: "Vej Nr, Postnr By". Falder tilbage til display_name. */
export function parseNominatimAddresses(rows: NominatimRow[]): AddressHit[] {
  const out: AddressHit[] = [];
  for (const r of rows) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;

    const a = r.address ?? {};
    const by = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? null;
    const vej = a.road ?? null;
    const nr = a.house_number ?? null;

    const dele: string[] = [];
    if (vej) dele.push(nr ? `${vej} ${nr}` : vej);
    const postdel = [a.postcode, by].filter(Boolean).join(" ");
    if (postdel) dele.push(postdel);

    const tekst = dele.length > 0 ? dele.join(", ") : (r.display_name ?? "").trim();
    if (!tekst) continue;

    out.push({ tekst, lat, lon, place: by });
  }
  return out;
}

export const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

/** Query-streng til dansk adressesøgning. Holdt adskilt så den kan testes. */
export function addressSearchUrl(q: string): string {
  const p = new URLSearchParams({
    q,
    countrycodes: "dk",
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    "accept-language": "da",
  });
  return `${NOMINATIM_SEARCH}?${p.toString()}`;
}
