import type { Shelter } from "../types/shelter";
import { getCity, getPetsAllowed } from "./shelter-detail";

/**
 * Fjerner `geofa_raw` fra shelters der skal sendes til en LISTE-flade, og
 * erstatter den med de to værdier kortene faktisk bruger fra den.
 *
 * HVORFOR: `geofa_raw` fylder i snit ~3 KB pr. shelter. Målt i produktion
 * bestod /teltplads' 928 KB HTML af 529 KB RSC-payload, som stort set var de
 * rå GeoFA-objekter for alle 273 shelters. ShelterCard er en klient-komponent
 * og kaldte `getCity()` og `getPetsAllowed()`, der begge læser den rå JSON —
 * så hele blobben måtte med over ledningen for at udlede to felter.
 *
 * `getWater()` læser også geofa_raw, men kun som fallback når `water`-kolonnen
 * er null. Den er udfyldt på alle 1.689 rækker, så fallbacken udløses aldrig i
 * praksis, og der er intet at forudberegne.
 *
 * BRUGES KUN TIL LISTER. Detaljesiderne skal fortsat have `geofa_raw`: de viser
 * faciliteter, kontaktinfo og fakta direkte fra den.
 *
 * Bemærk at feltet stadig hentes fra databasen — det er kun klient-payloaden der
 * slankes her. Vil man også spare Supabase-egress, skal selve SELECT'en hente
 * enkelte JSON-stier i stedet for hele objektet.
 */
export function slimShelterForList<T extends Shelter>(shelter: T): T {
  // Udled FØR blobben fjernes.
  const derived_city = getCity(shelter);
  const derived_pets_allowed = getPetsAllowed(shelter);
  const { geofa_raw: _dropped, ...rest } = shelter;
  return { ...rest, derived_city, derived_pets_allowed } as T;
}

export function slimSheltersForList<T extends Shelter>(shelters: T[]): T[] {
  return shelters.map(slimShelterForList);
}
