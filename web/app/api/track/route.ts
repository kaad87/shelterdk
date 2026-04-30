import { NextRequest, NextResponse } from "next/server";
import { sendGa4Event } from "@/lib/server-analytics";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "search_performed",
  "filter_applied",
  "shelter_viewed",
  "newsletter_signup",
  "share_click",
  "outbound_click",
  "community_submit",
]);

type EventValue = string | number | boolean | null | undefined;

function sanitizeParams(input: unknown): Record<string, EventValue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const result: Record<string, EventValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      result[key] = value;
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  let body: {
    event?: string;
    params?: Record<string, unknown>;
    path?: string;
    title?: string;
    referrer?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Ugyldig event" }, { status: 400 });
  }

  await sendGa4Event({
    headers: req.headers,
    eventName: event,
    eventParams: sanitizeParams(body.params),
    path: typeof body.path === "string" ? body.path : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    skipIfConsentAccept: true,
  });

  return new NextResponse(null, { status: 204 });
}
