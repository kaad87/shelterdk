export function getAllowedImageHosts(): Set<string> {
  const hosts = new Set<string>([
    "dynamic-media-cdn.tripadvisor.com",
    "cdn.campanyon.com",
    "media.glampinghub.com",
    "images.unsplash.com",
    "placehold.co",
    "lh3.googleusercontent.com",
    "unsplash.com",
    "mapcentia-www.s3-eu-west-1.amazonaws.com",
    "geofa.geodanmark.dk",
    "udinaturen.dk",
    "book.naturstyrelsen.dk",
    "kortservice2.vejle.dk",
    "apps.aalborgkommune.dk",
    "webkort.esbjergkommune.dk",
    "webkort.herning.dk",
    "naturstyrelsen.dk",
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof supabaseUrl === "string" && supabaseUrl.trim()) {
    try {
      hosts.add(new URL(supabaseUrl).hostname);
    } catch {
      // ignore
    }
  }

  return hosts;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Hosts vi springer proxy over for (fx signed URLs der kun virker i browser). */
const STATIC_SKIP_PROXY_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "plus.unsplash.com",
  "unsplash.com",
  "mapcentia-www.s3-eu-west-1.amazonaws.com",
  "dynamic-media-cdn.tripadvisor.com",
  "cdn.campanyon.com",
  "media.glampinghub.com",
  "placehold.co",
]);

function getSkipProxyHosts(): Set<string> {
  // BEMÆRK: Supabase storage er IKKE en image-CDN — den leverer rå filer
  // uden transformation. Vi MÅ ikke skippe proxy for Supabase, ellers
  // sendes 3-5 MB owner-uploadede iPhone-fotos direkte til browseren
  // til 200px thumbnails. Skip-listen er kun til hosts der allerede
  // leverer optimerede billeder (Unsplash, Tripadvisor, Glamping Hub osv).
  return STATIC_SKIP_PROXY_HOSTS;
}

function isAlreadyProxiedUrl(url: string): boolean {
  return url.startsWith("/api/image/") || url.includes("/api/image?url=");
}

export function computeImageProxyKey(
  url: string,
  opts?: { q?: number; w?: number },
): string {
  const input = `${url.trim()}|q:${opts?.q ?? ""}|w:${opts?.w ?? ""}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function isUnoptimizedImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  // Når et billede allerede går gennem vores egen /api/image-proxy, skal det
  // ikke bagefter igennem Netlifys /_next/image-optimering også. Ellers får
  // vi et dyrt dobbelt-hop: upstream -> /api/image -> /_next/image -> browser.
  if (isAlreadyProxiedUrl(u)) return true;
  if (u.startsWith("/api/google-photo")) return true;
  if (!isHttpUrl(u)) return false;
  try {
    return getSkipProxyHosts().has(new URL(u).hostname);
  } catch {
    return false;
  }
}

export function getProxiedImageSrc(
  url: string,
  opts?: { q?: number; w?: number },
): string {
  const u = (url || "").trim();
  if (!u) return u;

  // Build suffix from opts
  const suffix = [
    opts?.q != null ? `&q=${opts.q}` : "",
    opts?.w != null ? `&w=${opts.w}` : "",
  ].join("");

  // Already proxied — just append opts
  if (u.startsWith("/api/image/")) {
    if (!suffix) return u;
    return `${u}${u.includes("?") ? "&" : "?"}${suffix.slice(1)}`;
  }
  if (u.includes("/api/image?url=")) return u + suffix;
  if (u.startsWith("/api/google-photo")) return u;

  if (!isHttpUrl(u)) return u;
  try {
    const host = new URL(u).hostname;
    if (getSkipProxyHosts().has(host)) return u;
  } catch {
    // invalid URL, proxy anyway
  }
  const key = computeImageProxyKey(u, opts);
  return `/api/image/${key}?url=${encodeURIComponent(u)}${suffix}`;
}
