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

export function getProxiedImageSrc(url: string): string {
  const u = (url || "").trim();
  if (!u) return u;
  if (!isHttpUrl(u)) return u;
  // Avoid double proxying
  if (u.includes("/api/image?url=")) return u;
  return `/api/image?url=${encodeURIComponent(u)}`;
}

