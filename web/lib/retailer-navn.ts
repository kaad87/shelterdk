/**
 * Butikkens visningsnavn ud fra retailer-noeglen i affiliate_products.
 *
 * Laa foer som et opslagsobjekt inde i GearCardClient med tre noegler
 * (outmore, backpackerlife, outdoortid), typet til netop de tre. Feedet har
 * otte: optalt 9. november 2026 stod der 68 produkter i publicerede guider
 * fra de fem butikker objektet ikke kendte, og de rendrede "Hos  · Annonce"
 * med tomt navn, fordi et manglende opslag giver undefined og React skriver
 * ingenting. Et tomt butiksnavn under et affiliate-link er praecis det sted
 * man ikke vil have et hul: det er der, laeseren skal kunne se hvem pengene
 * gaar til.
 *
 * Reserven er noeglen med stort begyndelsesbogstav frem for tom streng, saa
 * en ny butik i feedet giver et laeseligt navn med det samme i stedet for at
 * forsvinde lydloest indtil nogen opdager det.
 */
const NAVNE: Record<string, string> = {
  backpackerlife: "Backpackerlife.dk",
  outmore: "Outmore.dk",
  outdoortid: "Outdoortid.dk",
  prooutdoor: "ProOutdoor.dk",
  outnorth: "Outnorth.dk",
  outdoornu: "OutdoorNu.dk",
  outdooricentrum: "OutdoorICentrum.dk",
  zeejuu: "Zeejuu.dk",
};

export function retailerNavn(retailer: string | null | undefined): string {
  const noegle = (retailer ?? "").trim().toLowerCase();
  if (!noegle) return "vores partner";
  return NAVNE[noegle] ?? noegle.charAt(0).toUpperCase() + noegle.slice(1);
}
