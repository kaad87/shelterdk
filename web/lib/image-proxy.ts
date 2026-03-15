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
const SKIP_PROXY_HOSTS = new Set(["lh3.googleusercontent.com"]);

export function isUnoptimizedImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (u.startsWith("/api/google-photo")) return true;
  if (!isHttpUrl(u)) return false;
  try {
    return SKIP_PROXY_HOSTS.has(new URL(u).hostname);
  } catch {
    return false;
  }
}

export function getProxiedImageSrc(url: string): string {
  const u = (url || "").trim();
  if (!u) return u;
  if (!isHttpUrl(u)) return u;
  if (u.includes("/api/image?url=") || u.startsWith("/api/google-photo")) return u;
  try {
    const host = new URL(u).hostname;
    if (SKIP_PROXY_HOSTS.has(host)) return u;
  } catch {
    // invalid URL, proxy anyway
  }
  return `/api/image?url=${encodeURIComponent(u)}`;
}

