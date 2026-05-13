export const RESERVED_REDIRECT_PREFIXES = ["/api", "/admin", "/ejer", "/_next"];

export function normalizeRedirectSourcePath(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash !== "/" && withSlash.endsWith("/")) {
    return withSlash.replace(/\/+$/, "");
  }
  return withSlash;
}

export function normalizeRedirectDestination(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return normalizeRedirectSourcePath(trimmed);
}
