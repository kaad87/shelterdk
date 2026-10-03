import { NextResponse, type NextRequest } from "next/server";
import { addressSearchUrl, parseNominatimAddresses } from "@/lib/address-search";

export const dynamic = "force-dynamic";

/**
 * Adressesøgning til admin-fladerne — server-side med vilje.
 *
 * Erstatter DAWA's /adgangsadresser/autocomplete, som lukkede 1. oktober 2026.
 * Kaldet går gennem os selv af to grunde, ikke kun bekvemmelighed:
 *
 *  1. Nominatims brugspolitik kræver en identificerbar User-Agent. Browsere
 *     nægter at sætte den header, så et klient-kald ville bryde politikken.
 *  2. Sitets CSP har en lukket connect-src. Det gamle DAWA-kald stod ikke på
 *     listen og var derfor blokeret i produktion allerede før DAWA lukkede —
 *     feltet har reelt ikke virket siden CSP'en kom til i maj. Et
 *     samme-oprindelse-kald kræver ingen allowlist.
 *
 * Svaret caches i en time: adresser flytter sig ikke, og det holder antallet
 * af kald til Nominatim nede.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(addressSearchUrl(q), {
      headers: {
        Accept: "application/json",
        "User-Agent": "shelterdk/1.0 (https://shelterdk.dk; hej@shelterdk.dk)",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    return NextResponse.json({ results: parseNominatimAddresses(await res.json()) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
