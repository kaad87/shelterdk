"use client";

import { useSearchParams } from "next/navigation";

/**
 * Delt tom instans. Skal være modul-niveau, ikke en ny URLSearchParams pr.
 * render — ellers skifter referencen hver gang og `useMemo`/`useEffect` med
 * searchParams i deps-listen kører uafbrudt.
 */
const EMPTY_PARAMS = new URLSearchParams();

/**
 * `useSearchParams()` der aldrig er null.
 *
 * Next typer hooket som non-nullable, men den returnerer i praksis `null` når
 * en klient-komponent renderes under statisk prerender uden Suspense-grænse.
 * Fordi typen lyver, fangede hverken tsc eller review det, og resultatet var
 * `Cannot read properties of null (reading 'get')` — 93 fejl på 30 dage, flest
 * på /soeg, hvor kaldet sker inde i en useMemo.
 *
 * Brug denne i stedet for `useSearchParams()` i alle klient-komponenter.
 */
export function useSafeSearchParams(): URLSearchParams {
  const sp = useSearchParams() as ReturnType<typeof useSearchParams> | null;
  return sp ?? EMPTY_PARAMS;
}
