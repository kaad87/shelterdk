/**
 * Reparerer forhandler-beskrivelser, før de sendes videre som strukturerede data.
 *
 * Forhandlernes feeds afkorter beskrivelsen: 133 af de 136 tekster, guiderne
 * bruger, er mellem 252 og 255 tegn, og kun 2 af dem slutter med tegnsætning.
 * Teksten til Treklife Low-back UL ender på "Den k". Kolonnen i basen er
 * `text` uden længdegrænse, så det er ikke os der klipper — den fulde tekst
 * findes ikke hos os og kan ikke hentes tilbage.
 *
 * Det betyder noget, fordi teksten går ordret videre til Product.description i
 * JSON-LD, altså til Google. Et afbrudt ord midt i strukturerede data er
 * sjusk, der er synligt udefra.
 *
 * Signalet er tegnsætningen, ikke længden: prosa slutter med et punktum.
 * Mangler det, er teksten klippet, og så klippes den tilbage til sidste hele
 * sætning. Ville det kaste over halvdelen væk, beholdes teksten og kun det
 * afskårne ord ryger — ellers ville en specliste blive skåret ned til sit
 * første mål.
 */

const SHORTCODE = /\[[a-z_]+[^\]]*\]/gi;
const SLUTTER_RENT = /[.!?)»"'”]$/;
/** Sætningsslut = tegn efterfulgt af mellemrum. Afsluttende tal ("3,5.") tæller med. */
const GRÆNSE = /[.!?][\s)»"'”]/g;

/**
 * To forskellige spørgsmål, som først blev blandet sammen i ét tal på 80 og
 * derved kastede fuldt brugbare sætninger væk:
 *
 * MINDSTE_GRÆNSE er hvor kort en hel sætning må være, før den ikke er værd at
 * klippe ned til. En hel sætning er næsten altid at foretrække, så den er lav.
 *
 * MINDSTE_NYTTIGE er hvor kort en beskrivelse må være, før vi helt undlader at
 * sende den med. Begge er absolutte tal og ikke andele, fordi det afgørende
 * er, om teksten stadig siger noget — ikke hvor meget af originalen der
 * overlevede.
 */
const MINDSTE_GRÆNSE = 40;
const MINDSTE_NYTTIGE = 40;

/**
 * Længde hvorover en tekst uden sluttegn må antages at være afkortet af feedet.
 *
 * Tegnsætning alene er ikke nok. Feedets punktopstillinger indeholder ikke et
 * eneste punktum — "Mål: 160 x 80 cm … Vægt: 450g" er en komplet beskrivelse,
 * den slutter bare på sin sidste værdi. Uden dette tjek klippede reparationen
 * et ord af hver gang og ødelagde netop de tekster, der var i orden.
 *
 * Målt på de 136 beskrivelser guiderne bruger: de afkortede ligger på 248-255
 * tegn, de komplette er kortere. Grænsen sættes derfor under den gruppe.
 */
const FEED_AFKORTER_VED = 240;

/** Kortest mulige hele beskrivelse. Under det er det et enkelt ord, ikke tekst. */
const MINDSTE_SÆTNING = 15;

/**
 * Bindeord teksten ikke må ende på. Da faldet tilbage til "drop sidste ord"
 * blev målt på de 136 rigtige tekster, endte 18 af dem på "og", "hvortil"
 * eller "derfor" — et helt ord, men midt i en tanke.
 */
const HÆNGENDE = new RegExp(
  "\\s+(?:og|eller|men|samt|som|der|som\\s+er|hvortil|hvorfor|hvilket|der|til|med|" +
  "for|af|på|i|at|fra|om|ved|så|hvis|når|mens|end|dog|derfor|desuden|er|var|har|kan|skal|vil|bliver|giver|vejer|gør)$",
  "i",
);

export function helTekst(raw: string | null | undefined, maxLength = 500): string | null {
  if (!raw) return null;

  // Længden skal måles FØR shortcodes fjernes. Feedet afkorter ved ~255 tegn
  // inklusive dem, og en [kad_youtube …]-shortcode er omkring 88 tegn. Målt
  // på de 202 beskrivelser guiderne bruger: tolv af dem var afkortede midt i
  // et ord, men stod kun til 166-187 tegn efter strip og slap derfor gennem
  // længde-porten som "for korte til at være afkortede".
  const råLængde = raw.replace(/\s+/g, " ").trim().length;

  let t = raw.replace(SHORTCODE, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  // Grænserne må aldrig overstige halvdelen af budgettet. Ellers kan en lille
  // maxLength gøre sætnings-stien uopnåelig, så et kort kald altid faldt ned i
  // nødudgangen og returnerede null.
  const grænse = Math.min(MINDSTE_GRÆNSE, Math.floor(maxLength / 2));
  const nyttig = Math.min(MINDSTE_NYTTIGE, Math.floor(maxLength / 2));

  // Tre tilfælde hvor teksten ikke skal repareres: vi klipper den selv (så den
  // ER afkortet og skal repareres), den slutter rent (hel), eller den er kort
  // nok til at feedet ikke kan have afkortet den (hel, selv uden sluttegn).
  // En hel men kort tekst skal ikke måles med reparations-stiens minimum: en
  // forhandler kan skrive "Letvægtsstol, 1030 g." og mene det. Kravet er
  // derfor kun, at der står en sætning og ikke et enkelt ord.
  const hel = (x: string) =>
    x.includes(" ") && x.length >= MINDSTE_SÆTNING ? x : null;
  if (t.length > maxLength) t = t.slice(0, maxLength);
  else if (SLUTTER_RENT.test(t)) return hel(t);
  else if (råLængde < FEED_AFKORTER_VED) return hel(t);

  // Sidste sætningsgrænse i teksten — den giver altid et rent slutpunkt.
  let sidste = -1;
  for (const m of t.matchAll(GRÆNSE)) sidste = m.index;
  if (sidste >= 0 && sidste + 1 >= grænse) {
    return t.slice(0, sidste + 1);
  }

  // Ingen grænse langt nok inde: smid det sidste, muligvis halve, ord væk og
  // derefter et eventuelt bindeord, så teksten ikke ender midt i en tanke.
  const mellemrum = t.lastIndexOf(" ");
  if (mellemrum <= 0) return null;
  let rest = t.slice(0, mellemrum);
  for (let i = 0; i < 3; i++) {
    const kortere = rest.replace(/[,;:\s]+$/, "").replace(HÆNGENDE, "");
    if (kortere === rest) break;
    rest = kortere;
  }

  // Feedets punktopstillinger kommer som én linje uden et eneste punktum:
  // "Mål: 120 x 60 cm … Vægt: 300g Nedpakket st". Når det afskårne ord er
  // droppet, står der tit en mærkat tilbage uden sin værdi — eller et tal
  // uden sin enhed. Begge læses som en afbrudt sætning, så de ryger med.
  // En liste der ender på sin værdi ("Vægt: 450g") er derimod komplet og
  // bliver stående, selv om den ikke slutter med punktum.
  for (let i = 0; i < 2; i++) {
    const kortere = rest
      .replace(/\s+\p{Lu}[\p{L}-]*$/u, "")   // dinglende mærkat: ét ord med stort begyndelsesbogstav
      .replace(/\s+\d+([,.]\d+)?$/u, "");    // efterladt tal uden enhed
    if (kortere === rest) break;
    rest = kortere;
  }

  rest = rest.replace(/[,;:\s]+$/, "");
  return rest.length >= nyttig ? rest : null;
}
