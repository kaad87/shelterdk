import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-klient med service_role nøgle til server-side write operationer.
 * Bruges KUN i API routes der kræver write-adgang (admin, submit, upload).
 * Service_role nøglen bypasser RLS — brug den ALDRIG i browser-kode.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local"
    );
  }

  // VIGTIGT: tving no-store på alle requests. Ellers cacher Next.js' patchede fetch
  // supabase-js' GET-queries i Data Cache — selv i force-dynamic-ruter — hvilket gav
  // forældede reads (fx availability-kalenderen viste ikke nye bookinger → datoen så
  // "ledig" ud i kalenderen, men blev afvist ved booking). Admin-klienten bruges kun
  // i dynamiske ruter, så friske reads er altid korrekt; ingen effekt på public-cachen.
  return createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/**
 * Som createAdminClient(), men UDEN `cache: "no-store"` — så Next.js må cache
 * svaret og ruten kan forblive statisk/ISR.
 *
 * Brug KUN til data der tåler at være op til `revalidate` gammel: metadata som
 * booking-enheders titel/pris eller publicerede anmeldelser. Brug ALDRIG til
 * availability/bookingstatus — de skal være friske, og de hentes i forvejen
 * klient-side via /api/shelter-availability.
 *
 * Baggrund: no-store-varianten gør hele ruten dynamisk i Next 14. Det kostede
 * shelter-detaljesiderne (1.683 stk) CDN-caching og gav 320-590 ms TTFB mod
 * ~80 ms på cachede sider.
 */
export function createCacheableAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local"
    );
  }

  return createClient(url, key);
}
