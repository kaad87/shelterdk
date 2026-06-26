import { createClient } from "@supabase/supabase-js";
import { normalizeRedirectSourcePath } from "@/lib/custom-redirect-utils";

type RedirectRule = { destination_url: string; status_code: 301 | 302 | 307 | 308 };

// Dette opslag kørte i middleware på HVER sidevisning (~744k DB-kald/106 dage) mod
// en tabel med ganske få aktive redirects. Vi loader i stedet hele det aktive sæt
// ind i hukommelsen og matcher in-memory, med en kort TTL. Match-semantikken er
// identisk: eksakt match på normaliseret source_path blandt is_active-rækker.
// Effekt på admin: en ny/ændret redirect slår igennem efter højst TTL i stedet for
// øjeblikkeligt. Cachen er pr. runtime-instans (nulstilles ved cold start).
const CACHE_TTL_MS = 60_000;

let cache: { map: Map<string, RedirectRule>; expires: number } | null = null;
let inflight: Promise<Map<string, RedirectRule>> | null = null;

async function loadActiveRedirects(): Promise<Map<string, RedirectRule>> {
  const map = new Map<string, RedirectRule>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return map;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Hård timeout: middleware kører som edge-funktion, så et hængende DB-kald (fx under
  // egress-throttling) må ALDRIG kunne timeout'e hele funktionen. Ved timeout/fejl
  // returnerer vi et tomt sæt → ingen redirects et øjeblik, men siden lever.
  const { data, error } = await supabase
    .from("custom_redirects")
    .select("source_path,destination_url,status_code")
    .eq("is_active", true)
    .abortSignal(AbortSignal.timeout(2000));

  if (error) {
    console.error("custom redirect load failed:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.source_path as string, {
      destination_url: row.destination_url as string,
      status_code: row.status_code as RedirectRule["status_code"],
    });
  }
  return map;
}

async function getRedirectMap(): Promise<Map<string, RedirectRule>> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.map;
  if (inflight) return inflight;

  inflight = loadActiveRedirects()
    .then((map) => {
      cache = { map, expires: Date.now() + CACHE_TTL_MS };
      return map;
    })
    .finally(() => {
      inflight = null;
    });

  // Hvis vi har et udløbet (men brugbart) cache-snapshot, server det mens refresh
  // kører, så ingen request blokerer på DB'en.
  if (cache) return cache.map;
  return inflight;
}

export async function findActiveRedirect(sourcePath: string): Promise<RedirectRule | null> {
  const source = normalizeRedirectSourcePath(sourcePath);
  try {
    const map = await getRedirectMap();
    return map.get(source) ?? null;
  } catch (error) {
    console.error("custom redirect lookup failed:", error);
    return null;
  }
}
