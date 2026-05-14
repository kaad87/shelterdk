// web/app/api/activate-booking/route.ts
import { sendBookingActivationEmails } from "@/lib/email";
import { ipTimestamps } from "./_store";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiting — 3 submissions/min per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

export async function POST(request: Request) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const timestamps = ipTimestamps.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return Response.json(
      { error: "For mange forsøg. Prøv igen om lidt." },
      { status: 429 }
    );
  }
  recent.push(now);
  ipTimestamps.set(ip, recent);

  let body: {
    name?: string;
    organisation?: string;
    email?: string;
    shelterName?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length > 200) {
    return Response.json(
      { error: "Navn er påkrævet (maks 200 tegn)" },
      { status: 400 }
    );
  }

  const organisation = body.organisation?.trim();
  if (!organisation || organisation.length > 200) {
    return Response.json(
      { error: "Organisation er påkrævet (maks 200 tegn)" },
      { status: 400 }
    );
  }

  const email = body.email?.trim();
  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: "Ugyldig email-adresse" }, { status: 400 });
  }

  const shelterName = body.shelterName?.trim();
  if (!shelterName || shelterName.length > 200) {
    return Response.json(
      { error: "Shelterets navn er påkrævet (maks 200 tegn)" },
      { status: 400 }
    );
  }

  const message = body.message?.trim() || null;
  if (message && message.length > 1000) {
    return Response.json(
      { error: "Besked må højst være 1000 tegn" },
      { status: 400 }
    );
  }

  try {
    await sendBookingActivationEmails({
      name,
      organisation,
      email,
      shelterName,
      message,
    });
  } catch (err) {
    console.error("Booking activation email failed:", err);
    return Response.json(
      { error: "Noget gik galt — prøv igen" },
      { status: 500 }
    );
  }

  return Response.json({ success: true }, { status: 201 });
}
