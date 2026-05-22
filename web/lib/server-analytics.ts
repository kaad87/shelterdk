import { createHash } from "node:crypto";
import { CONSENT_COOKIE, type ConsentChoice } from "@/lib/consent";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

interface SendGa4EventOptions {
  eventName: string;
  eventParams?: AnalyticsParams;
  headers?: Headers;
  identityKey?: string;
  path?: string;
  title?: string;
  referrer?: string;
  skipIfConsentAccept?: boolean;
  /** Used for server-confirmed backend events (e.g. Stripe webhook purchase)
   * where there is no request cookie context available. */
  bypassConsentCheck?: boolean;
}

function getCookieMap(headers: Headers): Map<string, string> {
  const cookieHeader = headers.get("cookie") ?? "";
  const map = new Map<string, string>();

  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) continue;
    map.set(key, valueParts.join("=").trim());
  }

  return map;
}

function getConsent(headers: Headers): ConsentChoice | null {
  const consent = getCookieMap(headers).get(CONSENT_COOKIE);
  if (consent === "marketing" || consent === "analytics" || consent === "necessary") {
    return consent;
  }
  if (consent === "accept") return "marketing";
  return null;
}

function getOrigin(headers: Headers): string {
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("host") ?? headers.get("x-forwarded-host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
}

function buildAbsoluteUrl(path: string, headers: Headers): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getOrigin(headers)}${path.startsWith("/") ? path : `/${path}`}`;
}

function dailyHash(source: string, granularity: "day" | "hour"): string {
  const now = new Date();
  const key =
    granularity === "hour"
      ? now.toISOString().slice(0, 13)
      : now.toISOString().slice(0, 10);

  return createHash("sha256")
    .update(`${source}|${key}`)
    .digest("hex");
}

function stableHash(source: string): string {
  return createHash("sha256")
    .update(source)
    .digest("hex");
}

function extractGaClientId(headers: Headers): string | null {
  const gaCookie = getCookieMap(headers).get("_ga");
  if (!gaCookie) return null;

  const match = gaCookie.match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return match?.[1] ?? null;
}

function buildFallbackIdentity(headers: Headers, identityKey?: string) {
  if (identityKey) {
    return {
      clientId: stableHash(identityKey).slice(0, 16),
      sessionId: parseInt(dailyHash(identityKey, "hour").slice(0, 8), 16).toString(),
    };
  }

  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = headers.get("user-agent") ?? "unknown";
  const source = `${ip}|${ua}`;

  return {
    clientId: dailyHash(source, "day").slice(0, 16),
    sessionId: parseInt(dailyHash(source, "hour").slice(0, 8), 16).toString(),
  };
}

function normalizeParams(params?: AnalyticsParams): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue;
    normalized[key] = typeof value === "boolean" ? String(value) : value;
  }

  return normalized;
}

export async function sendGa4Event({
  eventName,
  eventParams,
  headers = new Headers(),
  identityKey,
  path,
  title,
  referrer,
  skipIfConsentAccept = false,
  bypassConsentCheck = false,
}: SendGa4EventOptions): Promise<boolean> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return false;

  const consent = getConsent(headers);
  if (!bypassConsentCheck) {
    const hasAnalyticsConsent = consent === "analytics" || consent === "marketing";
    if (!hasAnalyticsConsent) return false;
    if (skipIfConsentAccept && consent === "marketing") return false;
  }

  const fallbackIdentity = buildFallbackIdentity(headers, identityKey);
  const clientId = extractGaClientId(headers) ?? fallbackIdentity.clientId;
  const sessionId = fallbackIdentity.sessionId;

  const params = normalizeParams(eventParams);
  params.engagement_time_msec = 100;
  params.session_id = sessionId;

  if (path) params.page_location = buildAbsoluteUrl(path, headers);
  if (title) params.page_title = title.slice(0, 100);
  if (referrer) params.page_referrer = referrer;

  const payload = {
    client_id: clientId,
    events: [{ name: eventName, params }],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}
