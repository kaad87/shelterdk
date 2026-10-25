import { NextRequest, NextResponse } from "next/server";
import { sendGa4Event } from "@/lib/server-analytics";
import { createClient } from "@supabase/supabase-js";
import { INTERNAL_EVENTS, TRACKABLE_EVENTS, internalEventRow } from "@/lib/internal-events";
import { referrerVaert } from "@/lib/henvisningskilde";

export const dynamic = "force-dynamic";

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
  if (!TRACKABLE_EVENTS.has(event)) {
    return NextResponse.json({ error: "Ugyldig event" }, { status: 400 });
  }

  // Skrivninger der skal være færdige, før svaret sendes.
  //
  // De to Supabase-indsættelser var fire-and-forget .then()-kæder, og ruten
  // returnerede 204 bagefter. På en serverless-platform kan containeren
  // fryses i det øjeblik svaret er sendt, og så lander skrivningen aldrig —
  // uden fejl og uden log. Det er den slags tab, der gør en måling ubrugelig
  // uden at nogen opdager det: grej-blokken havde 10 landinger mod 8
  // registrerede klik.
  //
  // Fejl må stadig ikke vælte svaret, så de samles med allSettled og logges.
  const skrivninger: PromiseLike<unknown>[] = [];

  // Affiliate-klik logges også i egen DB (anonymt, ingen bruger-id) så
  // produktvalg/rækkefølge kan optimeres på rigtige tal — GA4 alene kan ikke
  // querys frit.
  // Kun vaertsnavnet, aldrig stien eller forespoergselsstrengen. Referreren
  // har hele tiden vaeret opsamlet i browseren, men blev kun sendt videre til
  // GA4, som ligger bag samtykkeporten og maalt faar omkring 3 % af den
  // reelle optaelling. En AI-henvisning kunne derfor kun ses, naar
  // assistenten selv satte en utm-parameter, og Claude og Gemini goer det
  // ofte ikke.
  const referrerHost = referrerVaert(
    typeof body.referrer === "string" ? body.referrer : null
  );

  if (event === "affiliate_click") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const p = sanitizeParams(body.params);
      const sb = createClient(url, key, { auth: { persistSession: false } });
      skrivninger.push(sb.from("affiliate_clicks")
        .insert({
          product_name: typeof p.product_name === "string" ? p.product_name.slice(0, 200) : null,
          retailer: typeof p.retailer === "string" ? p.retailer.slice(0, 50) : null,
          brand: typeof p.brand === "string" ? p.brand.slice(0, 100) : null,
          category: typeof p.item_category === "string" ? p.item_category.slice(0, 50) : null,
          placement: typeof p.placement === "string" ? p.placement.slice(0, 50) : null,
          price_dkk: typeof p.value === "number" ? p.value : null,
          outbound_url: typeof p.outbound_url === "string" ? p.outbound_url.slice(0, 500) : null,
          path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
          referrer_host: referrerHost,
        })
        .then(({ error }) => {
          if (error) console.warn("affiliate_clicks insert:", error.message);
        }));
    }
  }

  // Events vi træffer beslutninger på skrives også anonymt til Supabase.
  // GA4-kaldet nedenfor er bag en samtykkeport, og cookien sættes først når
  // nogen trykker i banneret — målt giver det ~3% af den reelle optælling.
  if (INTERNAL_EVENTS.has(event)) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const row = { ...internalEventRow(event, body.params, body.path), referrer_host: referrerHost };
      skrivninger.push(createClient(url, key, { auth: { persistSession: false } })
        .from("internal_events")
        .insert(row)
        .then(({ error }) => {
          if (error) console.warn("internal_events insert:", error.message);
        }));
    }
  }

  await Promise.allSettled([
    ...skrivninger,
    sendGa4Event({
      headers: req.headers,
      eventName: event,
      eventParams: sanitizeParams(body.params),
      path: typeof body.path === "string" ? body.path : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      referrer: typeof body.referrer === "string" ? body.referrer : undefined,
      skipIfConsentAccept: true,
    }),
  ]);

  return new NextResponse(null, { status: 204 });
}
