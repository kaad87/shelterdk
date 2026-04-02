/**
 * Normaliser og valider Instagram post/reel/tv-URL til brug i embed.
 * Accepterer bl.a.:
 *   instagram.com/p/ABC123/
 *   instagram.com/username/p/ABC123/?igsh=...
 *   instagram.com/reel/ABC123/
 *   instagram.com/username/reel/ABC123/
 */
export function normalizeInstagramPostUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t.startsWith("http") ? t : `https://${t}`);
  } catch {
    return null;
  }
  if (!u.hostname.endsWith("instagram.com")) return null;
  const path = u.pathname.replace(/\/+$/, "") + "/";
  // Match /p/ID/, /reel/ID/, /tv/ID/ — optionally preceded by /username/
  const m = path.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/$/i);
  if (!m) return null;
  return `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/`;
}


export function isValidInstagramPostUrl(raw: string): boolean {
  return normalizeInstagramPostUrl(raw) !== null;
}
