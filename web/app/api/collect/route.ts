import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

/**
 * Server-side page_view for users who chose "Kun nødvendige".
 * Sender ét anonymt page_view til GA4 Measurement Protocol (ingen cookie til tracking).
 * Brugere med "Acceptér alle" sendes ikke her – GTM håndterer dem.
 *
 * client_id: SHA-256(ip + userAgent + dato) → pseudo-anonym daglig ID.
 * Skifter hver dag, gemmes aldrig, kræver ingen cookie.
 * session_id: SHA-256(ip + userAgent + time) → ny session hver time.
 * page_referrer: sendes med fra klienten så GA4 kan bestemme trafikkanal.
 */
const CONSENT_COOKIE = "shelterdk_consent";

function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
}

/**
 * Derives a pseudo-anonymous, daily-rotating identifier from IP and User-Agent.
 * Returns a 16-char hex string. Never stored, changes every day.
 */
function dailyHash(ip: string, ua: string, granularity: "day" | "hour"): string {
  const now = new Date();
  const key =
    granularity === "hour"
      ? now.toISOString().slice(0, 13) // "YYYY-MM-DDTHH"
      : now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return createHash("sha256")
    .update(`${ip}|${ua}|${key}`)
    .digest("hex");
}

export async function POST(req: NextRequest) {
  const consent = req.cookies.get(CONSENT_COOKIE)?.value;
  if (consent === "accept") {
    // GTM handles these users — don't double-count
    return new NextResponse(null, { status: 204 });
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    return new NextResponse(null, { status: 204 });
  }

  let path: string;
  let title: string | undefined;
  let referrer: string | undefined;
  try {
    const body = await req.json();
    path = typeof body?.path === "string" ? body.path : "/";
    title = typeof body?.title === "string" ? body.title.slice(0, 100) : undefined;
    referrer = typeof body?.referrer === "string" && body.referrer ? body.referrer : undefined;
  } catch {
    path = "/";
  }

  // Pseudo-anonymous IDs — no cookies, no persistent storage
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";

  const clientId = dailyHash(ip, ua, "day").slice(0, 16);
  // GA4 session_id must be a decimal integer string
  const sessionId = parseInt(dailyHash(ip, ua, "hour").slice(0, 8), 16).toString();

  const origin = getOrigin(req);
  const pageLocation = path.startsWith("http") ? path : `${origin}${path}`;

  const eventParams: Record<string, string | number> = {
    page_location: pageLocation,
    engagement_time_msec: 100,
    session_id: sessionId,
  };
  if (title) eventParams.page_title = title;
  if (referrer) eventParams.page_referrer = referrer;

  const payload = {
    client_id: clientId,
    events: [{ name: "page_view", params: eventParams }],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // ignore — tracking is non-critical
  }

  return new NextResponse(null, { status: 204 });
}
