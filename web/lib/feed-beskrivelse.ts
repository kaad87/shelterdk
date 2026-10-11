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
 * Reglen bruger to signaler, ikke ét. Tegnsætning: prosa slutter med et
 * punktum, så mangler det, KAN teksten være klippet. Rålængde: feedet afkorter
 * ved omkring 255 tegn, så en kortere tekst uden punktum er ikke klippet — den
 * er en punktopstilling der slutter på sin sidste værdi. Begge skal være
 * opfyldt, før teksten repareres; med tegnsætning alene klippede reparationen
 * et ord af hver komplet specliste.
 *
 * Repareres den, klippes den tilbage til sidste hele sætning. Findes ingen,
 * ryger det afskårne ord, et eventuelt hængende bindeord og en mærkat uden
 * værdi.
 */

const SHORTCODE = /\[[a-z_]+[^\]]*\]/gi;
const SLUTTER_RENT = /[.!?)»"'”]$/;
/** Sætningsslut = tegn efterfulgt af mellemrum. Afsluttende tal ("3,5.") tæller med. */
const GRÆNSE = /[.!?][\s)»"'”]/g;

/**
 * Hvor kort et resultat må være — både når vi klipper til en hel sætning, og
 * når vi afgør om resten er værd at sende med.
 *
 * Det var først to konstanter med hver sin begrundelse, men samme værdi, så
 * forskellen var ikke til at observere og ikke til at teste. Ét tal med ét
 * navn siger det samme uden at påstå en skelnen der ikke findes.
 *
 * Det er et absolut tal og ikke en andel: det afgørende er, om teksten stadig
 * siger noget — ikke hvor meget af originalen der overlevede. En tidligere
 * version regnede i andel og kastede derfor fuldt brugbare sætninger væk.
 */
const MINDSTE_BRUGBARE = 40;

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
  "\\s+(?:og|eller|men|samt|som|der|hvortil|hvorfor|hvilket|til|med|" +
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
  const brugbar = Math.min(MINDSTE_BRUGBARE, Math.floor(maxLength / 2));

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
  if (sidste >= 0 && sidste + 1 >= brugbar) {
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
  // Feedets punktopstillinger kommer som én linje uden et eneste punktum:
  // "Mål: 120 x 60 cm … Vægt: 300g Nedpakket st". Når det afskårne ord er
  // droppet, står der tit en mærkat tilbage uden sin værdi — eller et tal
  // uden sin enhed. Begge læses som en afbrudt sætning, så de ryger med.
  // En liste der ender på sin værdi ("Vægt: 450g") er derimod komplet og
  // bliver stående, selv om den ikke slutter med punktum.
  //
  // Men et mærkenavn har også stort begyndelsesbogstav, og det skal blive
  // stående: "… fra tyske Mil-Tec" må ikke ende som "… fra tyske", hvor både
  // oplysningen er tabt og sætningen hænger. Konteksten adskiller dem. En
  // punktopstilling har mange store begyndelsesbogstaver midt i teksten
  // ("Mål:", "Fås", "Fremstillet", "Vægt:"); prosa har få. I en liste må
  // ethvert dinglende ord derfor væk, mens der i prosa kun fjernes et ord der
  // står efter en værdi.
  const storeMidtI = (rest.match(/\s\p{Lu}/gu) ?? []).length;
  const erListe = storeMidtI >= 3;
  for (let i = 0; i < 2; i++) {
    const kortere = rest
      .replace(
        erListe ? /\s+\p{Lu}[\p{L}-]*$/u : /(\d\S*)\s+\p{Lu}[\p{L}-]*$/u,
        erListe ? "" : "$1",
      )
      .replace(/\s+\d+([,.]\d+)?$/u, "");    // efterladt tal uden enhed
    if (kortere === rest) break;
    rest = kortere;
  }

  rest = rest.replace(/[,;:\s]+$/, "");
  return rest.length >= brugbar ? rest : null;
}
