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
  let t = raw.replace(SHORTCODE, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  if (t.length > maxLength) t = t.slice(0, maxLength);
  else if (SLUTTER_RENT.test(t)) return t;

  // Grænserne må aldrig overstige halvdelen af budgettet. Ellers kan en lille
  // maxLength gøre sætnings-stien uopnåelig, så et kort kald altid faldt ned i
  // nødudgangen og returnerede null.
  const grænse = Math.min(MINDSTE_GRÆNSE, Math.floor(maxLength / 2));
  const nyttig = Math.min(MINDSTE_NYTTIGE, Math.floor(maxLength / 2));

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
  rest = rest.replace(/[,;:\s]+$/, "");
  return rest.length >= nyttig ? rest : null;
}
