/**
 * Metabeskrivelsen til /grej/[slug].
 *
 * Skabelonen var fire faste dele: navn plus best_for, score, pris og antal
 * butikker. En vare med kort best_for og kun én butik fyldte derfor kun de
 * to foerste, og 170 af de 362 sider endte under 110 tegn, maalt 2. november
 * 2026. "PETZL SWIFT RL: kraftig / reaktiv. Vi giver den 8,9 af 10. Pris fra
 * 799,95 kr." er 77 tegn, hvor Google viser omkring 155. Halvdelen af
 * snippet-pladsen stod tom paa knap halvdelen af siderne.
 *
 * Fejlen var ikke at der manglede én bestemt saetning, men at skabelonen
 * ikke vidste hvor lang den var blevet. Derfor samles beskrivelsen nu af en
 * prioriteret liste, hvor der tilfoejes saa laenge der er plads.
 */

/**
 * Hvor langt Google viser. Tallet er ikke en haard graense hos Google, men
 * et snit: over det bliver resten klippet, saa der er ingen grund til at
 * skrive laengere.
 */
export const BESKRIVELSE_MAKS = 155;

/**
 * Samler delene til én beskrivelse inden for `maks`.
 *
 * Den foerste del kommer altid med, ogsaa hvis den alene er for lang: det er
 * produktnavnet, og en beskrivelse uden navnet er ubrugelig. Resten
 * tilfoejes i raekkefoelge saa laenge de kan vaere.
 *
 * En del der ikke kan vaere, springes over uden at stoppe resten. Delene er
 * selvstaendige saetninger, saa en kortere del laengere nede kan godt komme
 * med efter en der blev sprunget over. Det fylder pladsen bedre end at
 * stoppe ved den foerste der ikke passer.
 */
export function samlBeskrivelse(
  dele: (string | null | undefined)[],
  maks: number = BESKRIVELSE_MAKS
): string {
  const med = dele.filter((d): d is string => typeof d === "string" && d.trim() !== "");
  if (med.length === 0) return "";

  let ud = med[0].trim();
  for (const del of med.slice(1)) {
    const naeste = `${ud} ${del.trim()}`;
    if (naeste.length <= maks) ud = naeste;
  }
  return ud;
}
