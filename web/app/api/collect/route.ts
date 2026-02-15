import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side page_view for users who chose "Kun nødvendige".
 * Sender ét anonymt page_view til GA4 Measurement Protocol (ingen cookie til tracking).
 * Brugere med "Acceptér alle" sendes ikke her – GTM håndterer dem.
 */
const CONSENT_COOKIE = "shelterdk_consent";

function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";
}

export async function POST(req: NextRequest) {
  const consent = req.cookies.get(CONSENT_COOKIE)?.value;
  if (consent === "accept") {
    return new NextResponse(null, { status: 204 });
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    return new NextResponse(null, { status: 204 });
  }

  let path: string;
  let title: string | undefined;
  try {
    const body = await req.json();
    path = typeof body?.path === "string" ? body.path : "/";
    title = typeof body?.title === "string" ? body.title.slice(0, 100) : undefined;
  } catch {
    path = "/";
  }

  const origin = getOrigin(req);
  const pageLocation = path.startsWith("http") ? path : `${origin}${path}`;

  const clientId = crypto.randomUUID();
  const payload = {
    client_id: clientId,
    events: [
      {
        name: "page_view",
        params: {
          page_location: pageLocation,
          ...(title && { page_title: title }),
          engagement_time_msec: 100,
        },
      },
    ],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // ignore
  }

  return new NextResponse(null, { status: 204 });
}
