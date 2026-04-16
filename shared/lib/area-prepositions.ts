/** Dansk grammatik: korrekt forholdsord for hvert område. */
const AREA_PREPOSITION: Record<string, string> = {
  // Øer → "på"
  bornholm: "på",
  lolland: "på",
  "lolland-falster": "på",
  fanoe: "på",
  samsoe: "på",
  laesoe: "på",
  // Ruter/veje → "på"
  haervejen: "på",
  // Farvande/fjorde → "ved"
  limfjorden: "ved",
  vadehavet: "ved",
};

export function prepositionForArea(area: { slug: string }): string {
  return AREA_PREPOSITION[area.slug] ?? "i";
}

/** Korrekt forholdsord for regionsnavn (Fyn, Sjælland, Bornholm → "på", resten → "i"). */
export function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  if (r === "fyn" || r === "sjælland" || r === "sjælland og øerne" || r === "bornholm") return "på";
  return "i";
}
