/**
 * Kanoniser region-slug-varianter for "Sjælland og Øerne" og "Fyn" → den form
 * den pågældende route faktisk serverer, så vi undgår 404'er fra crawlere/gamle
 * links der blander de to slug-former.
 *
 *  - Region-hub + facet-sider serveres på KORT slug ("sjaelland"/"fyn").
 *  - Kommune-/shelter-sider under /danmark serveres på LANG slug ("sjaelland-og-oeerne").
 *  - "fyn-og-oeerne" er aldrig gyldig (DB-region er bare "Fyn") → altid "fyn".
 *
 * Returnerer den korrekte sti, eller null hvis stien ikke skal redirectes.
 */
export function regionSlugRedirect(pathname: string): string | null {
  // Fyn: "fyn-og-oeerne" findes aldrig — altid kort "fyn".
  if (pathname === "/danmark/fyn-og-oeerne") return "/danmark/fyn";
  if (pathname.startsWith("/danmark/fyn-og-oeerne/"))
    return "/danmark/fyn/" + pathname.slice("/danmark/fyn-og-oeerne/".length);

  // Sjælland og Øerne:
  if (pathname === "/danmark/sjaelland-og-oeerne") return "/danmark/sjaelland"; // bare hub: lang → kort
  if (pathname.startsWith("/danmark/sjaelland/")) // kommune/shelter: kort → lang
    return "/danmark/sjaelland-og-oeerne/" + pathname.slice("/danmark/sjaelland/".length);

  // Facet-sider (fx /shelter-med-vand/sjaelland-og-oeerne): lang → kort.
  const facet = pathname.match(/^\/(shelter-[a-z0-9-]+)\/(sjaelland-og-oeerne|fyn-og-oeerne)$/);
  if (facet) return `/${facet[1]}/${facet[2] === "fyn-og-oeerne" ? "fyn" : "sjaelland"}`;

  return null;
}
