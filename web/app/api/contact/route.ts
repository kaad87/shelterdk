import { createPublicClient } from "@/utils/supabase/server-public";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const ipTimestamps = new Map<string, number[]>();

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange beskeder. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  let body: { name?: string; email?: string; category?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const category = body.category?.trim() || "general";
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return Response.json(
      { error: "Udfyld venligst navn, email og besked." },
      { status: 400 }
    );
  }

  if (message.length > 5000) {
    return Response.json(
      { error: "Beskeden er for lang (max 5000 tegn)." },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({ error: "Ugyldig email-adresse." }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { error } = await supabase.from("contact_messages").insert({
    name,
    email,
    category,
    message,
  });

  if (error) {
    console.error("contact insert:", error);
    return Response.json(
      { error: "Kunne ikke sende besked. Prøv igen." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
