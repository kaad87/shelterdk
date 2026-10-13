/**
 * Ét sted at definere de betalte overnatningstyper: etiket, farve og ikon.
 *
 * Findes fordi oplysningen ellers bor tre steder. Pop-up'en paa kortet skrev
 * "Glamping · fra X kr/nat" for enhver type, saa en campingplads blev kaldt
 * glamping; admin havde sin egen liste; og markoeren havde én farve for alle.
 * Tre kopier af det samme ordforraad glider fra hinanden, og det var allerede
 * sket.
 *
 * Farvevalg: alle betalte steder deler samme form og samme guld, saa de laeses
 * som ét lag, der er tydeligt forskelligt fra de graa shelter-pins. Typen
 * adskilles af glyffen indeni, ikke af fire konkurrerende farver. Et kort med
 * fire ligevaerdige farver fortaeller ingen rangorden og bliver et farvekort.
 *
 * Glyfferne er bevidst geometriske og fylder 72 % af markoeren. Foerste
 * udgave brugte 62 % og finere former, og ved kortets 28 px blev
 * autocamperpladsens kasse til en tankestreg uden betydning og hytten til en
 * klat. Formerne er nu valgt efter hvad der kan kendes fra hinanden ved
 * omkring 20 px: en spids trekant, en lav kuppel, et tag der dominerer sin
 * krop, og en vogn med synligt forparti.
 */

export interface StayType {
  /** Vaerdien i databasens type-kolonne. */
  key: string;
  /** Hvad brugeren ser, ental. */
  label: string;
  /** Flertal, til lag-knappen og optaellinger. */
  plural: string;
  /** SVG-sti tegnet i en 24x24-boks, centreret i markoeren. */
  glyph: string;
}

/** Dark slate on brand gold measures 5,3:1, so the glyph stays readable. */
export const PIN_FILL = "#C5A059";
export const PIN_BORDER = "#8A6A26";
export const PIN_GLYPH = "#2C3E50";

export const STAY_TYPES: StayType[] = [
  {
    key: "campingplads",
    label: "Campingplads",
    plural: "Campingpladser",
    // Telt: hoej, spids trekant. Spidsen er det der skiller den fra kuplen.
    glyph: "M12 3 L21 20 H3 Z",
  },
  {
    key: "autocamperplads",
    label: "Autocamperplads",
    plural: "Autocamperpladser",
    // Vogn set fra siden: hoej boks bagtil, lavere forparti fortil. Trinnet
    // er hele identiteten; uden det er formen bare et rektangel.
    glyph: "M2 6 h12 v5 h4 l4 4 v5 H2 Z",
  },
  {
    key: "hytte",
    label: "Hytte",
    plural: "Hytter",
    // Hus: bredt, dominerende tag over en lav krop. Taget skal baere
    // genkendelsen, fordi kroppen forsvinder foerst naar den bliver lille.
    glyph: "M12 2.5 L23 12 H19.5 V21 H4.5 V12 H1 Z",
  },
  {
    key: "glamping",
    label: "Glamping",
    plural: "Glamping",
    // Kuppel: bred, lav halvcirkel. Lav nok til ikke at ligne teltets spids.
    glyph: "M1.5 19.5 A10.5 10.5 0 0 1 22.5 19.5 Z",
  },
];

/**
 * De kuraterede typer tabellen oprindeligt blev bygget til. De deler glyf med
 * den naermeste af de fire ovenfor, saa et gammelt sted ikke bliver ikonloest.
 */
const LEGACY: Record<string, { label: string; glyphFrom: string }> = {
  glamping_telt: { label: "Glampingtelt", glyphFrom: "glamping" },
  naturhytte: { label: "Naturhytte", glyphFrom: "hytte" },
  dome: { label: "Dome", glyphFrom: "glamping" },
  traehus: { label: "Træhus", glyphFrom: "hytte" },
  tiny_house: { label: "Tiny house", glyphFrom: "hytte" },
  luksus_shelter: { label: "Luksus-shelter", glyphFrom: "hytte" },
  andet: { label: "Naturophold", glyphFrom: "hytte" },
};

const BY_KEY = new Map(STAY_TYPES.map((t) => [t.key, t]));

/** Etiket til visning. Ukendte typer vises som de staar, ikke som "andet". */
export function stayLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? LEGACY[key]?.label ?? key;
}

/** Glyf til markoeren. Ukendte typer faar campingpladsens, saa pin'en findes. */
export function stayGlyph(key: string): string {
  const direct = BY_KEY.get(key);
  if (direct) return direct.glyph;
  const legacy = LEGACY[key];
  if (legacy) return BY_KEY.get(legacy.glyphFrom)!.glyph;
  return BY_KEY.get("campingplads")!.glyph;
}

/**
 * Markoeren som HTML, til Leaflets divIcon.
 *
 * divIcon og ikke et billede: fire typer gange to tilstande ville vaere otte
 * assets at holde i sync med farverne her, og en SVG i markup kan arve
 * tilstandene uden en ekstra netvaerksrunde.
 */
export function stayMarkerHtml(typeKey: string, size = 28): string {
  const inner = Math.round(size * 0.72);
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:9999px;` +
    `background:${PIN_FILL};border:2px solid ${PIN_BORDER};` +
    `box-shadow:0 1px 4px rgba(44,62,80,.45);` +
    `display:flex;align-items:center;justify-content:center;">` +
    `<svg width="${inner}" height="${inner}" viewBox="0 0 24 24" aria-hidden="true">` +
    `<path d="${stayGlyph(typeKey)}" fill="${PIN_GLYPH}"/></svg></div>`
  );
}
