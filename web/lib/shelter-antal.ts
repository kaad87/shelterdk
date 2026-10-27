/**
 * Ét tal for "hvor mange shelters har ShelterDK".
 *
 * Fandtes ikke foer, og saa sagde sitet tre forskellige ting paa samme tid:
 * forsiden 1700 (levende tal), /koeb-shelter "over 1.600" og ShelterCTA
 * "800+". ShelterCTA staar paa snesevis af sider, saa 800+ var det tal, de
 * fleste besoegende faktisk saa, og det var under halvdelen af virkeligheden.
 * En ekstern SEO-audit fangede uoverensstemmelsen 27. oktober 2026.
 *
 * Forsiden har i forvejen en taelling og bruger den. De oevrige steder bruger
 * konstanten herunder frem for hver sin egen query: ShelterCTA ville ellers
 * laegge en taelling paa hver sideopbygning, og projektet har allerede et
 * egress-overforbrug paa Supabase.
 */

/**
 * Antal shelters uden dubletter, afrundet nedad til naermeste 100, maalt
 * 27. oktober 2026: 1700 af 1830 raekker (resten er dubletter).
 *
 * Opdatér den, naar taellingen er vokset forbi naeste hundrede. Forsidens tal
 * er det levende, saa de to kan afvige med op til 100 mellem opdateringer, og
 * det er med vilje: alternativet er en query pr. sideopbygning.
 */
export const SHELTER_ANTAL = 1700;

/** "1.700+" paa dansk. Brug den, saa tusindtalsseparatoren er ens overalt. */
export const SHELTER_ANTAL_TEKST = `${SHELTER_ANTAL.toLocaleString("da-DK")}+`;

/**
 * Runder et levende tal, saa tillidstaelleren ikke hopper med hver ny plads.
 * Nedad, ikke til naermeste: 1.650 shelters maa ikke praesenteres som 1.700.
 */
export function rundShelterAntal(raa: number): number {
  return raa > 0 ? Math.floor(raa / 100) * 100 : SHELTER_ANTAL;
}
