import { NextRequest, NextResponse } from "next/server";
import { sendGa4Event } from "@/lib/server-analytics";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "search_performed",
  "filter_applied",
  "shelter_viewed",
  "view_item",
  "newsletter_signup",
  "share_click",
  "outbound_click",
  "affiliate_click",
  "community_submit",
  "book_button_clicked",
  "wishlist_changed",
  "add_to_wishlist",
  "payment_cancelled",
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

  // Affiliate-klik logges også i egen DB (anonymt, ingen bruger-id) så
  // produktvalg/rækkefølge kan optimeres på rigtige tal — GA4 alene kan ikke
  // querys frit. Fire-and-forget: fejl (fx manglende tabel før migration)
  // må aldrig blokere tracking-svaret.
  if (event === "affiliate_click") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const p = sanitizeParams(body.params);
      const sb = createClient(url, key, { auth: { persistSession: false } });
      sb.from("affiliate_clicks")
        .insert({
          product_name: typeof p.product_name === "string" ? p.product_name.slice(0, 200) : null,
          retailer: typeof p.retailer === "string" ? p.retailer.slice(0, 50) : null,
          brand: typeof p.brand === "string" ? p.brand.slice(0, 100) : null,
          category: typeof p.item_category === "string" ? p.item_category.slice(0, 50) : null,
          placement: typeof p.placement === "string" ? p.placement.slice(0, 50) : null,
          price_dkk: typeof p.value === "number" ? p.value : null,
          outbound_url: typeof p.outbound_url === "string" ? p.outbound_url.slice(0, 500) : null,
          path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
        })
        .then(({ error }) => {
          if (error) console.warn("affiliate_clicks insert:", error.message);
        });
    }
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
